import json
import asyncio
import hashlib
import math
import random
from channels.generic.websocket import AsyncWebsocketConsumer

# Mêmes constantes que le 1vs1 frontend
CANVAS_W = 800
CANVAS_H = 500
PADDLE_W = 12
PADDLE_H = 80
BALL_SIZE = 10
PADDLE_SPEED = 5
INITIAL_BALL_SPEED = 5
MAX_SCORE = 7
PADDLE_MARGIN = 20

waiting_players = []
game_states = {}    # room -> état du jeu
room_channels = {}  # room -> {'p1': channel, 'p2': channel}
player_keys = {}    # channel_name -> set de touches pressées


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


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.room_group_name = None
        self.is_game_running = False
        self.player_index = None
        player_keys[self.channel_name] = set()

    async def disconnect(self, close_code):
        global waiting_players
        player_keys.pop(self.channel_name, None)
        if self.channel_name in waiting_players:
            waiting_players.remove(self.channel_name)
        if self.room_group_name:
            self.is_game_running = False
            try:
                await self.channel_layer.group_send(
                    self.room_group_name, {'type': 'player_disconnect'}
                )
            except Exception:
                pass
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
            game_states.pop(self.room_group_name, None)
            room_channels.pop(self.room_group_name, None)

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'find_match':
            await self.handle_matchmaking()
        elif action == 'keydown':
            key = data.get('key')
            if key in ('ArrowUp', 'ArrowDown') and self.channel_name in player_keys:
                player_keys[self.channel_name].add(key)
        elif action == 'keyup':
            key = data.get('key')
            if self.channel_name in player_keys:
                player_keys[self.channel_name].discard(key)
        elif action == 'rematch':
            if self.room_group_name:
                state = game_states.get(self.room_group_name)
                if state and state['phase'] == 'gameover':
                    state['rematch_votes'] += 1
                    if state['rematch_votes'] >= 2:
                        state.update(fresh_game())

    async def handle_matchmaking(self):
        global waiting_players
        if waiting_players:
            opponent = waiting_players.pop(0)
            self.room_group_name = make_room_name(opponent, self.channel_name)
            self.player_index = 1  # J2

            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.channel_layer.group_add(self.room_group_name, opponent)

            game_states[self.room_group_name] = fresh_game()
            room_channels[self.room_group_name] = {'p1': opponent, 'p2': self.channel_name}

            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'match_found', 'room': self.room_group_name}
            )

            self.is_game_running = True
            asyncio.create_task(self.game_loop())
        else:
            self.player_index = 0  # J1
            waiting_players.append(self.channel_name)
            await self.send(json.dumps({'type': 'waiting'}))

    async def game_loop(self):
        while self.is_game_running:
            state = game_states.get(self.room_group_name)
            channels = room_channels.get(self.room_group_name)
            if not state or not channels:
                break

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

                # Rebond murs haut/bas
                if ball['y'] - BALL_SIZE / 2 <= 0:
                    ball['y'] = BALL_SIZE / 2
                    ball['vy'] *= -1
                if ball['y'] + BALL_SIZE / 2 >= CANVAS_H:
                    ball['y'] = CANVAS_H - BALL_SIZE / 2
                    ball['vy'] *= -1

                # Collision raquette P1 (gauche) — même logique que le 1vs1
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

                # Collision raquette P2 (droite)
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

                # Point marqué
                if ball['x'] < 0:
                    state['score2'] += 1
                    if state['score2'] >= MAX_SCORE:
                        state['phase'] = 'gameover'
                        state['winner'] = 2
                    else:
                        state['phase'] = 'scored'
                        state['reset_timer'] = 90  # 1.5s à 60fps
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

            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'game_state_update', 'state': send_state}
            )
            await asyncio.sleep(1 / 60)

    async def match_found(self, event):
        if not self.room_group_name:
            self.room_group_name = event['room']
        await self.send(json.dumps({'type': 'match_found'}))

    async def game_state_update(self, event):
        await self.send(json.dumps({'type': 'game_state', 'state': event['state']}))

    async def player_disconnect(self, event):
        self.is_game_running = False
        await self.send(json.dumps({'type': 'player_disconnect'}))
