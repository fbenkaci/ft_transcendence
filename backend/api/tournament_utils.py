import random
from typing import List, Optional

class Player:
    def __init__(self, name:str, seed: Optional[int] = None):
        self.name = name
        self.seed = seed

    def __repr__(self):
        return f"{self.name} (Seed: {self.seed})" if self.seed else self.name

class Match:
    def __init__(self, player1: Optional[Player], player2: Optional[Player]):
        self.player1 = player1
        self.player2 = player2
        self.winner = None

    def __repr__(self):
        return f"{self.player1} vs {self.player2}"

class TournamentBracket:
    def __init__(self):
        self.players = []
        self.bracket = []

    def add_player(self, name:str):
        self.players.append(Player(name))

    def finalize_bracket(self):
        if len(self.players) < 2:
            raise ValueError("Il faut au moins 2 joueurs")

        self.assign_random_seeds()

        sorted_players = sorted(self.players, key=lambda p: p.seed)

        self.bracket = self.generate_bracket(sorted_players)

        return self.bracket

    def assign_random_seeds(self):
        seeds = list(range(1, len(self.players) + 1))
        random.shuffle(seeds)

        for player, seed in zip(self.players, seeds):
            player.seed = seed

    def generate_bracket(self, sorted_players: List[Player]) -> List[Match]:
        n = len(sorted_players)
        size = 1
        
        while size < n:
            size *= 2
        
        padded = sorted_players + [None] * (size -n )
        matches = []
        
        for i in range(size // 2):
            player1 = padded[i]
            player2 = padded[size - 1 - i]
            m = Match(player1, player2)

            if player1 is not None and player2 is None:
                m.winner = player1
            elif player2 is not None and player1 is None:
                m.winner = player2
            matches.append(m)
            
        return matches
    
    def next_round(self, finish_matches: List[Match]) -> List[Match]:
        winners = [m.winner for m in finish_matches if m.winner is not None]
        
        if len(winners) < 2:
            return []
        
        matches = []
        for i in range(0, len(winners), 2):
            p1 = winners[i]
            p2 = winners[i + 1] if i + 1 < len(winners) else None
            matches.append(Match(p1, p2))
        
        return matches