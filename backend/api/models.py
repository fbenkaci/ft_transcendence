from django.db import models
from django.contrib.auth.models import User

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

# Create your models here.
