import random

from .models import TournamentMatch, TournamentParticipant


def _create_round(tournament, round_no, profile_pairs):
    for slot, (a, b) in enumerate(profile_pairs):
        is_bye = (a is None) != (b is None)
        TournamentMatch.objects.create(
            tournament=tournament,
            round=round_no,
            slot=slot,
            player1=a,
            player2=b,
            status='finished' if is_bye else 'pending',
            winner=(a or b) if is_bye else None,
        )


def _check_round_completion(tournament, round_no):
    matches = list(tournament.matches.filter(round=round_no).order_by('slot'))
    if not matches or any(m.status != 'finished' for m in matches):
        return

    winners = [m.winner for m in matches if m.winner is not None]

    if len(winners) <= 1:
        tournament.winner = winners[0] if winners else None
        tournament.status = 'completed'
        tournament.save()
        return

    next_round = round_no + 1
    if tournament.matches.filter(round=next_round).exists():
        return

    pairs = []
    for i in range(0, len(winners), 2):
        a = winners[i]
        b = winners[i + 1] if i + 1 < len(winners) else None
        pairs.append((a, b))

    _create_round(tournament, next_round, pairs)
    _check_round_completion(tournament, next_round)


def create_bracket(tournament):
    participants = list(tournament.participants.all())
    if len(participants) < 2:
        raise ValueError("Il faut au moins 2 joueurs pour démarrer le tournoi")

    seeds = list(range(1, len(participants) + 1))
    random.shuffle(seeds)
    for participant, seed in zip(participants, seeds):
        participant.seed = seed
        participant.save()

    ordered = sorted(participants, key=lambda p: p.seed)
    profiles = [p.player for p in ordered]

    size = 1
    while size < len(profiles):
        size *= 2
    padded = profiles + [None] * (size - len(profiles))

    pairs = [(padded[i], padded[size - 1 - i]) for i in range(size // 2)]
    _create_round(tournament, 1, pairs)

    tournament.status = 'ongoing'
    tournament.save()
    _check_round_completion(tournament, 1)


def report_result(match, winner_profile):
    if match.status == 'finished':
        return

    match.winner = winner_profile
    match.status = 'finished'
    match.save()

    # --- blockchain : enregistrer le résultat du match ---
    try:
        from blockchain import service
        service.store_match(
            match.tournament.chain_id.int,
            match.id,
            match.round,
            match.player1.user.username if match.player1 else "",
            match.player2.user.username if match.player2 else "",
            0, 0,  # scores non trackés pour l'instant
            winner_profile.user.username if winner_profile else "",
        )
    except Exception as e:
        print(f"[blockchain] store_match KO: {e}")



    loser = match.player1 if winner_profile == match.player2 else match.player2
    if loser is not None:
        TournamentParticipant.objects.filter(
            tournament=match.tournament, player=loser,
        ).update(is_eliminated=True)

    _check_round_completion(match.tournament, match.round)
