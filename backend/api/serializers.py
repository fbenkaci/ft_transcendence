from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Tournament, TournamentParticipant, TournamentMatch, Message


class TournamentMatchSerializer(serializers.ModelSerializer):
	player1 = serializers.CharField(source='player1.user.username', default=None, read_only=True)
	player2 = serializers.CharField(source='player2.user.username', default=None, read_only=True)
	winner = serializers.CharField(source='winner.user.username', default=None, read_only=True)

	class Meta:
		model = TournamentMatch
		fields = ('id', 'round', 'slot', 'player1', 'player2', 'winner', 'status', 'room_id')


class TournamentParticipantSerializer(serializers.ModelSerializer):
	username = serializers.CharField(source='player.user.username', read_only=True)

	class Meta:
		model = TournamentParticipant
		fields = ('username', 'seed', 'is_eliminated')


class TournamentSerializer(serializers.ModelSerializer):
	creator = serializers.CharField(source='creator.user.username', read_only=True)
	winner = serializers.CharField(source='winner.user.username', default=None, read_only=True)
	participants = TournamentParticipantSerializer(many=True, read_only=True)
	matches = TournamentMatchSerializer(many=True, read_only=True)
	participant_count = serializers.IntegerField(source='participants.count', read_only=True)

	class Meta:
		model = Tournament
		fields = (
			'id', 'name', 'creator', 'status', 'max_players', 'winner',
			'created_at', 'participant_count', 'participants', 'matches',
		)


class UserSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ('id', 'username', 'email', 'password')
		#IMPORTANT PERSONNE TOUCHE A CA:
		#ca permet d'éviter de renvoyer le mdp en claire
		extra_kwargs = {'password' : {'write_only': True}}
	
	def create(self, validated_data):
		user = User.objects.create_user(
			username=validated_data['username'],
			email=validated_data['email'],
			password=validated_data['password']
		)
		return user

class MessageSerializer(serializers.ModelSerializer):
	sender_username = serializers.CharField(source='sender.username', read_only=True)

	class Meta:
		model = Message
		fields = ['id', 'room', 'sender', 'sender_username', 'content', 'created_at', 'read', 'api_message']