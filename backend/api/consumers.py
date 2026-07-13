import json
import asyncio
import hashlib
import math
import random
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from django.db.models import F
from .models import Message
from .serializers import MessageSerializer


CANVAS_W = 800
CANVAS_H = 500
PADDLE_W = 12
PADDLE_H = 80
BALL_SIZE = 10
PADDLE_SPEED = 5
INITIAL_BALL_SPEED = 5
MAX_SCORE = 7
PADDLE_MARGIN = 20

RECONNECT_GRACE = 20

waiting_players = []
game_states = {}
room_channels = {}
room_users = {}
room_meta = {}
player_keys = {}
user_room = {}
opponent_user_id = {}


def make_room_name(ch1, ch2):
    names = sorted([ch1, ch2])
    h = hashlib.sha1(f"{names[0]}:{names[1]}".encode()).hexdigest()[:16]
    return f"game_{h}"


def launch_ball(to_right: bool):
    angle = random.uniform(-math.pi / 6, math.pi / 6)
    vx = INITIAL_BALL_SPEED * math.cos(angle) * (1 if to_right else -1)
    vy = INITIAL_BALL_SPEED * math.sin(angle)
    return vx, vy


def fresh_game():
    vx, vy = launch_ball(random.choice([True, False]))
    return {
        'p1y': CANVAS_H / 2 - PADDLE_H / 2,
        'p2y': CANVAS_H / 2 - PADDLE_H / 2,
        'ball': {'x': float(CANVAS_W / 2), 'y': float(CANVAS_H / 2), 'vx': vx, 'vy': vy},
        'score1': 0,
        'score2': 0,
        'phase': 'playing',
        'winner': None,
        'reset_timer': 0,
        'rematch_votes': 0,
    }


@database_sync_to_async
def record_stats(winner_uid, loser_uid):
    from .models import Profile
    if winner_uid:
        Profile.objects.filter(user_id=winner_uid).update(wins=F('wins') + 1)
    if loser_uid:
        Profile.objects.filter(user_id=loser_uid).update(losses=F('losses') + 1)


@database_sync_to_async
def record_tournament_result(tmatch_id, winner_uid):
    from .models import TournamentMatch, Profile
    from .tournament_service import report_result
    try:
        match = TournamentMatch.objects.select_related(
            'tournament', 'player1', 'player2',
        ).get(id=tmatch_id)
        winner = Profile.objects.get(user_id=winner_uid)
    except (TournamentMatch.DoesNotExist, Profile.DoesNotExist):
        return
    report_result(match, winner)


@database_sync_to_async
def get_tournament_match_users(tmatch_id):
    from .models import TournamentMatch
    try:
        m = TournamentMatch.objects.select_related('player1__user', 'player2__user').get(id=tmatch_id)
    except TournamentMatch.DoesNotExist:
        return (None, None, None)
    p1 = m.player1.user_id if m.player1 else None
    p2 = m.player2.user_id if m.player2 else None
    return (p1, p2, m.status)


def cleanup_room(room):
    game_states.pop(room, None)
    room_channels.pop(room, None)
    users = room_users.pop(room, None)
    meta = room_meta.pop(room, None)
    if meta and meta.get('grace'):
        meta['grace'].cancel()
    if users:
        for uid in (users.get('p1'), users.get('p2')):
            if uid and user_room.get(uid) == room:
                user_room.pop(uid, None)


async def on_game_over(room):
    meta = room_meta.get(room)
    state = game_states.get(room)
    users = room_users.get(room)
    if not meta or not state or not users or meta.get('recorded'):
        return
    meta['recorded'] = True
    meta['running'] = False

    winner_index = state.get('winner')
    if winner_index == 1:
        winner_uid, loser_uid = users.get('p1'), users.get('p2')
    elif winner_index == 2:
        winner_uid, loser_uid = users.get('p2'), users.get('p1')
    else:
        winner_uid = loser_uid = None

    if winner_uid or loser_uid:
        await record_stats(winner_uid, loser_uid)

    if meta.get('tmatch_id') and winner_uid:
        await record_tournament_result(meta['tmatch_id'], winner_uid)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        room, {'type': 'game_over', 'winner': winner_index},
    )


async def end_by_forfeit(room, present_uid):
    meta = room_meta.get(room)
    state = game_states.get(room)
    users = room_users.get(room)
    if not meta or not state or not users or meta.get('recorded'):
        return
    if users.get('p1') == present_uid:
        state['winner'] = 1
    elif users.get('p2') == present_uid:
        state['winner'] = 2
    state['phase'] = 'gameover'
    await on_game_over(room)
    cleanup_room(room)


async def grace_timeout(room, missing_slot, present_uid):
    await asyncio.sleep(RECONNECT_GRACE)
    channels = room_channels.get(room)
    meta = room_meta.get(room)
    if not channels or not meta or meta.get('recorded'):
        return
    if channels.get(missing_slot) is None:
        await end_by_forfeit(room, present_uid)


async def run_game_loop(room):
    channel_layer = get_channel_layer()
    while True:
        meta = room_meta.get(room)
        state = game_states.get(room)
        channels = room_channels.get(room)
        if not meta or not state or not channels or not meta.get('running'):
            break

        if meta.get('paused'):
            await channel_layer.group_send(room, {'type': 'game_paused'})
            await asyncio.sleep(0.5)
            continue

        if state['phase'] == 'playing':
            p1_keys = player_keys.get(channels['p1'], set())
            p2_keys = player_keys.get(channels['p2'], set())

            if 'ArrowUp' in p1_keys:
                state['p1y'] = max(0.0, state['p1y'] - PADDLE_SPEED)
            if 'ArrowDown' in p1_keys:
                state['p1y'] = min(CANVAS_H - PADDLE_H, state['p1y'] + PADDLE_SPEED)
            if 'ArrowUp' in p2_keys:
                state['p2y'] = max(0.0, state['p2y'] - PADDLE_SPEED)
            if 'ArrowDown' in p2_keys:
                state['p2y'] = min(CANVAS_H - PADDLE_H, state['p2y'] + PADDLE_SPEED)

            ball = state['ball']
            ball['x'] += ball['vx']
            ball['y'] += ball['vy']

            if ball['y'] - BALL_SIZE / 2 <= 0:
                ball['y'] = BALL_SIZE / 2
                ball['vy'] *= -1
            if ball['y'] + BALL_SIZE / 2 >= CANVAS_H:
                ball['y'] = CANVAS_H - BALL_SIZE / 2
                ball['vy'] *= -1

            p1_right = PADDLE_MARGIN + PADDLE_W
            if (ball['x'] - BALL_SIZE / 2 <= p1_right
                    and ball['x'] - BALL_SIZE / 2 >= PADDLE_MARGIN
                    and state['p1y'] <= ball['y'] <= state['p1y'] + PADDLE_H
                    and ball['vx'] < 0):
                hit = (ball['y'] - state['p1y']) / PADDLE_H - 0.5
                speed = math.sqrt(ball['vx'] ** 2 + ball['vy'] ** 2) * 1.04
                angle = hit * (math.pi / 3)
                ball['vx'] = abs(speed * math.cos(angle))
                ball['vy'] = speed * math.sin(angle)
                ball['x'] = p1_right + BALL_SIZE / 2

            p2x = CANVAS_W - PADDLE_MARGIN - PADDLE_W
            if (ball['x'] + BALL_SIZE / 2 >= p2x
                    and ball['x'] + BALL_SIZE / 2 <= p2x + PADDLE_W
                    and state['p2y'] <= ball['y'] <= state['p2y'] + PADDLE_H
                    and ball['vx'] > 0):
                hit = (ball['y'] - state['p2y']) / PADDLE_H - 0.5
                speed = math.sqrt(ball['vx'] ** 2 + ball['vy'] ** 2) * 1.04
                angle = hit * (math.pi / 3)
                ball['vx'] = -abs(speed * math.cos(angle))
                ball['vy'] = speed * math.sin(angle)
                ball['x'] = p2x - BALL_SIZE / 2

            if ball['x'] < 0:
                state['score2'] += 1
                if state['score2'] >= MAX_SCORE:
                    state['phase'] = 'gameover'
                    state['winner'] = 2
                else:
                    state['phase'] = 'scored'
                    state['reset_timer'] = 90
            elif ball['x'] > CANVAS_W:
                state['score1'] += 1
                if state['score1'] >= MAX_SCORE:
                    state['phase'] = 'gameover'
                    state['winner'] = 1
                else:
                    state['phase'] = 'scored'
                    state['reset_timer'] = 90

        elif state['phase'] == 'scored':
            state['reset_timer'] -= 1
            if state['reset_timer'] <= 0:
                vx, vy = launch_ball(state['score1'] <= state['score2'])
                state['ball'] = {
                    'x': float(CANVAS_W / 2), 'y': float(CANVAS_H / 2),
                    'vx': vx, 'vy': vy,
                }
                state['phase'] = 'playing'

        send_state = {
            'p1y': state['p1y'],
            'p2y': state['p2y'],
            'ball': {'x': state['ball']['x'], 'y': state['ball']['y']},
            'score1': state['score1'],
            'score2': state['score2'],
            'phase': state['phase'],
            'winner': state['winner'],
        }
        await channel_layer.group_send(
            room, {'type': 'game_state_update', 'state': send_state},
        )

        if state['phase'] == 'gameover':
            await on_game_over(room)
            break

        await asyncio.sleep(1 / 60)


def start_room(room, ch1, u1, ch2, u2, tmatch_id=None):
    game_states[room] = fresh_game()
    room_channels[room] = {'p1': ch1, 'p2': ch2}
    room_users[room] = {'p1': u1, 'p2': u2}
    room_meta[room] = {
        'running': True, 'paused': False, 'recorded': False,
        'tmatch_id': tmatch_id, 'grace': None,
    }
    if u1:
        user_room[u1] = room
    if u2:
        user_room[u2] = room
    asyncio.create_task(run_game_loop(room))


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.room_group_name = None
        self.player_index = None
        user = self.scope.get('user')
        self.user_id = user.id if (user and user.is_authenticated) else None
        player_keys[self.channel_name] = set()

        if self.user_id and self.user_id in user_room:
            await self.try_reconnect(user_room[self.user_id])

    async def try_reconnect(self, room):
        channels = room_channels.get(room)
        users = room_users.get(room)
        meta = room_meta.get(room)
        if not channels or not users or not meta or meta.get('recorded'):
            return

        slot = 'p1' if users.get('p1') == self.user_id else (
            'p2' if users.get('p2') == self.user_id else None)
        if slot is None:
            return

        channels[slot] = self.channel_name
        self.room_group_name = room
        self.player_index = 1 if slot == 'p1' else 2
        await self.channel_layer.group_add(room, self.channel_name)

        if meta.get('grace'):
            meta['grace'].cancel()
            meta['grace'] = None
        if channels.get('p1') and channels.get('p2'):
            meta['paused'] = False

        await self.send(json.dumps({
            'type': 'reconnected',
            'player': self.player_index,
            'state': game_states.get(room),
        }))

    async def disconnect(self, close_code):
        global waiting_players
        player_keys.pop(self.channel_name, None)
        if self.channel_name in waiting_players:
            waiting_players.remove(self.channel_name)

        room = self.room_group_name
        if not room or room not in room_channels:
            return

        channels = room_channels[room]
        slot = 'p1' if channels.get('p1') == self.channel_name else (
            'p2' if channels.get('p2') == self.channel_name else None)
        if slot:
            channels[slot] = None
        await self.channel_layer.group_discard(room, self.channel_name)

        meta = room_meta.get(room)
        if not meta:
            return

        if meta.get('recorded'):
            if not channels.get('p1') and not channels.get('p2'):
                cleanup_room(room)
            return

        if meta.get('running'):
            meta['paused'] = True
            users = room_users.get(room, {})
            present_uid = users.get('p2') if slot == 'p1' else users.get('p1')
            await self.channel_layer.group_send(room, {'type': 'opponent_left'})
            if present_uid is not None:
                meta['grace'] = asyncio.create_task(
                    grace_timeout(room, slot, present_uid))
            else:
                cleanup_room(room)
        else:
            cleanup_room(room)

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'find_match':
            await self.handle_matchmaking()
        elif action == 'join_tournament_match':
            await self.handle_tournament_match(data.get('match_id'))
        elif action == 'keydown':
            key = data.get('key')
            if key in ('ArrowUp', 'ArrowDown') and self.channel_name in player_keys:
                player_keys[self.channel_name].add(key)
        elif action == 'keyup':
            key = data.get('key')
            if self.channel_name in player_keys:
                player_keys[self.channel_name].discard(key)
        elif action == 'rematch':
            await self.handle_rematch()

    async def handle_matchmaking(self):
        global waiting_players
        if waiting_players:
            opponent = waiting_players.pop(0)
            room = make_room_name(opponent, self.channel_name)
            self.room_group_name = room
            self.player_index = 2

            await self.channel_layer.group_add(room, self.channel_name)
            await self.channel_layer.group_add(room, opponent)

            opp_uid = opponent_user_id.pop(opponent, None)
            start_room(room, opponent, opp_uid, self.channel_name, self.user_id)

            await self.channel_layer.group_send(
                room, {'type': 'match_found', 'room': room})
        else:
            self.player_index = 1
            opponent_user_id[self.channel_name] = self.user_id
            waiting_players.append(self.channel_name)
            await self.send(json.dumps({'type': 'waiting'}))

    async def handle_tournament_match(self, match_id):
        if not match_id or not self.user_id:
            await self.send(json.dumps({'type': 'error', 'msg': 'auth_required'}))
            return

        p1_uid, p2_uid, match_status = await get_tournament_match_users(match_id)
        if self.user_id not in (p1_uid, p2_uid):
            await self.send(json.dumps({'type': 'error', 'msg': 'not_a_participant'}))
            return
        if match_status == 'finished':
            await self.send(json.dumps({'type': 'error', 'msg': 'match_over'}))
            return

        room = f"tmatch_{match_id}"
        self.room_group_name = room
        await self.channel_layer.group_add(room, self.channel_name)

        if room not in room_channels:
            self.player_index = 1 if self.user_id == p1_uid else 2
            slot = 'p1' if self.player_index == 1 else 'p2'
            room_channels[room] = {'p1': None, 'p2': None}
            room_users[room] = {'p1': p1_uid, 'p2': p2_uid}
            room_channels[room][slot] = self.channel_name
            room_meta[room] = {
                'running': False, 'paused': False, 'recorded': False,
                'tmatch_id': match_id, 'grace': None,
            }
            user_room[self.user_id] = room
            await self.send(json.dumps({'type': 'waiting'}))
        else:
            channels = room_channels[room]
            users = room_users[room]
            self.player_index = 1 if self.user_id == users['p1'] else 2
            slot = 'p1' if self.player_index == 1 else 'p2'

            if room_meta[room].get('recorded'):
                await self.send(json.dumps({'type': 'error', 'msg': 'match_over'}))
                return

            channels[slot] = self.channel_name
            user_room[self.user_id] = room

            if channels.get('p1') and channels.get('p2') and not room_meta[room]['running']:
                game_states[room] = fresh_game()
                room_meta[room]['running'] = True
                room_meta[room]['paused'] = False
                asyncio.create_task(run_game_loop(room))
                await self.channel_layer.group_send(
                    room, {'type': 'match_found', 'room': room})

    async def handle_rematch(self):
        room = self.room_group_name
        if not room:
            return
        state = game_states.get(room)
        meta = room_meta.get(room)
        if not state or not meta or meta.get('tmatch_id'):
            return
        if state['phase'] == 'gameover':
            state['rematch_votes'] += 1
            if state['rematch_votes'] >= 2:
                game_states[room] = fresh_game()
                meta['recorded'] = False
                meta['running'] = True
                asyncio.create_task(run_game_loop(room))
                await self.channel_layer.group_send(
                    room, {'type': 'match_found', 'room': room})

    async def match_found(self, event):
        room = event['room']
        self.room_group_name = room
        channels = room_channels.get(room)
        if channels:
            self.player_index = 1 if channels.get('p1') == self.channel_name else 2
        await self.send(json.dumps({'type': 'match_found', 'player': self.player_index}))

    async def game_state_update(self, event):
        await self.send(json.dumps({'type': 'game_state', 'state': event['state']}))

    async def game_over(self, event):
        await self.send(json.dumps({'type': 'game_over', 'winner': event['winner']}))

    async def game_paused(self, event):
        await self.send(json.dumps({'type': 'paused'}))

    async def opponent_left(self, event):
        await self.send(json.dumps({'type': 'opponent_left'}))


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user not not user.is_authenticated:
            await slef.close()
            return
        # recup la room depuis le path params ou le querystring
        self.room = self.scope['url_route']['kwargs'].get('room')
        if not await self.user_allowed(self.scope['user'], self.room):
            await self.close()
            return
        self.group_name = f"chat_{self.room}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')
        if action == 'send_message':
            content = data.get('content','').strip()
            if not content:
                return
            msg = await self.create_message(self.room, self.scope['user'], content)
            payload = {
                'type': 'chat.message',
                'message': MessageSerializer(msg).data,
            }
            await self.channel_layer.group_send(self.group_name, payload)

    async def chat_message(self, event):
        await self.send(json.dumps(event['message']))

    @database_sync_to_async
    def create_message(self, room, user, content):
        return Message.objects.create(room=room, sender=user, content=content)

    @database_sync_to_async
    def user_allowed(self, user, room):
        # Exemple minimal: si room = "chat_{min}_{max}" vérifier que user.id est min ou max.
        try:
            parts = room.split('_')
            a,b = int(parts[1]), int(parts[2])
            return user.id in (a,b)
        except Exception:
            return False