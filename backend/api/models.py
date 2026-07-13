from django.db import models
from django.contrib.auth.models import User
import uuid

class Profile(models.Model):
    STATUS_CHOICES = (
        ('online', 'En ligne'),
        ('offline', 'Hors ligne'),
        ('ingame', 'En jeu'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    
    friends = models.ManyToManyField('self', symmetrical=True, blank=True)
    blocked_users = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='blocked_by')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='offline')

    is_2fa_enabled = models.BooleanField(default=False)
    two_factor_secret = models.CharField(max_length=64, blank=True, null=True)

    def __str__(self):
        return self.user.username

class FriendRequest(models.Model):
    sender = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='sent_requests')
    receiver = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='received_requests')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('sender', 'receiver')

    def __str__(self):
        return f"{self.sender.user.username} -> {self.receiver.user.username}"

# Create your models here.


class Tournament(models.Model):
    STATUS_CHOICES = (
        ('pending', 'En attente'),
        ('ongoing', 'En cours'),
        ('completed', 'Terminé'),
    )
    
    name = models.CharField(max_length=100)
    creator = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='tournaments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    max_players = models.IntegerField(default=8)
    winner = models.ForeignKey(
        Profile, on_delete=models.SET_NULL,
        related_name='tournaments_won', null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    chain_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    def __str__(self):
        return self.name
    
class TournamentParticipant(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='participants')
    player = models.ForeignKey(Profile, on_delete=models.CASCADE)
    seed = models.IntegerField(null=True, blank=True)
    is_eliminated = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ('tournament', 'player')
    
    def __str__(self):
        return f"{self.player.user.username} @ {self.tournament.name}"
    
class TournamentMatch(models.Model):   # était TorunamentMatch
    STATUS_CHOICES = (
        ('pending', 'En attente'),
        ('ongoing', 'En cours'),
        ('finished', 'Terminé'),
    )

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='matches')
    round = models.IntegerField(default=1)
    slot = models.IntegerField(default=0)
    player1 = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='matches_as_p1', null=True, blank=True)
    player2 = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='matches_as_p2', null=True, blank=True)
    winner = models.ForeignKey(Profile, on_delete=models.SET_NULL, related_name='matches_won', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    room_id = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        ordering = ['round', 'slot']

    def __str__(self):
        return f"R{self.round}.{self.slot}: {self.player1} vs {self.player2}"
    
