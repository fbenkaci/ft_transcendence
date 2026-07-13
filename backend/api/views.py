from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.shortcuts import get_object_or_404
from PIL import Image
from .models import Tournament, TournamentParticipant, TournamentMatch
from .serializers import TournamentSerializer
from .tournament_service import create_bracket
from django.db import models
from django.http import JsonResponse
import pyotp
from .models import Profile, FriendRequest
import os
from django.db import connection
from django.utils import timezone
import datetime
from blockchain import service


@api_view(['POST'])
@permission_classes([AllowAny])
def RegisterView(request):
    username = (request.data.get('username') or '').strip()
    email = (request.data.get('email') or '').strip()
    password = request.data.get('password') or ''

    if not username or not email or not password:
        return Response({"error": "Username, email et mot de passe requis"}, status=status.HTTP_400_BAD_REQUEST)
    if len(username) > 150:
        return Response({"error": "Username trop long"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_email(email)
    except ValidationError:
        return Response({"error": "Email invalide"}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username déjà pris"}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({"error": "Email déjà utilisé"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(password)
    except ValidationError as e:
        return Response({"error": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password)
    Profile.objects.get_or_create(user=user)
    return Response({"message": "Utilisateur créé"}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def custom_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    
    if user is None:
        return Response({"detail": "Identifiants incorrects"}, status=status.HTTP_401_UNAUTHORIZED)
    
    profile, _ = Profile.objects.get_or_create(user=user)
    if profile.is_2fa_enabled:
        return Response({"requires_2fa": True, "username": user.username}, status=status.HTTP_200_OK)
    
    refresh = RefreshToken.for_user(user)
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_2fa_login(request):
    username = request.data.get('username')
    code = request.data.get('code')
    if not username or not code:
        return Response({"error": "Username et code requis"}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(username=username).first()
    profile = Profile.objects.filter(user=user).first() if user else None
    if not profile or not profile.is_2fa_enabled or not profile.two_factor_secret:
        return Response({"error": "Code 2FA invalide"}, status=status.HTTP_400_BAD_REQUEST)

    totp = pyotp.TOTP(profile.two_factor_secret)
    if totp.verify(code):
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_200_OK)
    return Response({"error": "Code 2FA invalide"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    user = request.user
    profile, _ = Profile.objects.get_or_create(user=user)
    return Response({
        "username": user.username,
        "email": user.email,
        "avatar_url": profile.avatar.url if profile.avatar else None,
        "wins": profile.wins,
        "losses": profile.losses,
        "is_2fa_enabled": profile.is_2fa_enabled
    })

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_profile(request):
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    avatar = request.FILES.get('avatar')

    if new_password:
        if not old_password or not user.check_password(old_password):
            return Response({"error": "Ancien mot de passe incorrect sale singe"}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()

    if avatar:
        if avatar.size > 5 * 1024 * 1024:
            return Response({"error": "Image trop lourde (max 5 Mo) t'es fou ou quoi"}, status=status.HTTP_400_BAD_REQUEST)
        if avatar.content_type not in ('image/jpeg', 'image/png', 'image/gif', 'image/webp'):
            return Response({"error": "Format d'image non supporté"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            img = Image.open(avatar)
            img.verify()
            avatar.seek(0)
        except Exception:
            return Response({"error": "Fichier image invalide"}, status=status.HTTP_400_BAD_REQUEST)

        profile, created = Profile.objects.get_or_create(user=user)
        profile.avatar = avatar
        profile.save()
        return Response({
            "message": "Profil mis à jour",
            "avatar_url": profile.avatar.url
        }, status=status.HTTP_200_OK)

    return Response({"message": "Profil mis à jour youhouuu"}, status=status.HTTP_200_OK)

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def enable_2fa(request):
    profile = request.user.profile
    secret = pyotp.random_base32() 
    profile.two_factor_secret = secret
    profile.save()
    
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=request.user.email, issuer_name="Transcendence")
    return Response({"secret": secret, "uri": provisioning_uri}, status=status.HTTP_200_OK)

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def activate_2fa(request):
    profile = request.user.profile
    code = request.data.get('code')
    
    totp = pyotp.TOTP(profile.two_factor_secret)
    if totp.verify(code):
        profile.is_2fa_enabled = True
        profile.save()
        return Response({"message": "Authentification 2FA activée avec succès."}, status=status.HTTP_200_OK)
    return Response({"error": "Code invalide. lis bien."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def disable_2fa(request):
    profile = request.user.profile
    profile.is_2fa_enabled = False
    profile.two_factor_secret = None
    profile.save()
    return Response({"message": "Authentification 2FA désactivée."}, status=status.HTTP_200_OK)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_friends_list(request):
    friends = request.user.profile.friends.all()
    friends_data = []
    for friend in friends:
        friends_data.append({
            "username": friend.user.username,
            "status": friend.status,
            "avatar_url": friend.avatar.url if friend.avatar else None
        })
    return Response({"friends": friends_data}, status=status.HTTP_200_OK)

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def send_friend_request(request, username):
    sender_profile = request.user.profile
    target_user = get_object_or_404(User, username=username)
    receiver_profile = target_user.profile

    if sender_profile == receiver_profile:
        return Response({"error": "Tu ne peux pas t'ajouter toi-même (t'a pas d'amis a ce point)."}, status=status.HTTP_400_BAD_REQUEST)

    if receiver_profile in sender_profile.friends.all():
        return Response({"error": "Vous êtes déjà amis."}, status=status.HTTP_400_BAD_REQUEST)

    if FriendRequest.objects.filter(sender=sender_profile, receiver=receiver_profile).exists():
        return Response({"error": "Demande déjà envoyée en attente."}, status=status.HTTP_400_BAD_REQUEST)

    if FriendRequest.objects.filter(sender=receiver_profile, receiver=sender_profile).exists():
        return Response({"error": f"{username} t'a déjà envoyé une demande. Accepte-la SURTOUT PAS!"}, status=status.HTTP_400_BAD_REQUEST)

    FriendRequest.objects.create(sender=sender_profile, receiver=receiver_profile)
    return Response({"message": f"Demande envoyée à {username}."}, status=status.HTTP_200_OK)

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def respond_friend_request(request, username):
    action = request.data.get('action')
    receiver_profile = request.user.profile
    
    sender_user = get_object_or_404(User, username=username)
    sender_profile = sender_user.profile

    friend_req = FriendRequest.objects.filter(sender=sender_profile, receiver=receiver_profile).first()
    
    if not friend_req:
        return Response({"error": "Aucune demande trouvée de cet utilisateur."}, status=status.HTTP_404_NOT_FOUND)

    if action == 'accept':
        receiver_profile.friends.add(sender_profile)
        friend_req.delete()
        return Response({"message": f"Tu es maintenant ami avec {username}."}, status=status.HTTP_200_OK)
    elif action == 'reject':
        friend_req.delete()
        return Response({"message": f"Demande de {username} refusée cheh."}, status=status.HTTP_200_OK)
    else:
        return Response({"error": "Action invalide wsh t'es fou."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def remove_friend(request, username):
    user_profile = request.user.profile
    target_user = get_object_or_404(User, username=username)
    target_profile = target_user.profile

    if target_profile in user_profile.friends.all():
        user_profile.friends.remove(target_profile)
        return Response({"message": f"{username} retiré de tes amis (enfin il etait vrmt tunnel lui)."}, status=status.HTTP_200_OK)
    return Response({"error": "Cet utilisateur n'est pas ton ami (ouf)."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_friend_requests(request):
    requests = FriendRequest.objects.filter(receiver=request.user.profile)
    data = [{
        "username": req.sender.user.username,
        "avatar_url": req.sender.avatar.url if req.sender.avatar else None
    } for req in requests]
    return Response({"requests": data}, status=status.HTTP_200_OK)



@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def tournaments(request):
    if request.method == 'GET':
        qs = Tournament.objects.all().order_by('-created_at')
        return Response(TournamentSerializer(qs, many=True).data)

    name = (request.data.get('name') or '').strip()
    if not name or len(name) > 100:
        return Response({"error": "Nom requis (100 caractères max)"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        max_players = int(request.data.get('max_players', 8))
    except (TypeError, ValueError):
        return Response({"error": "max_players invalide"}, status=status.HTTP_400_BAD_REQUEST)
    if not 2 <= max_players <= 64:
        return Response({"error": "max_players doit être entre 2 et 64"}, status=status.HTTP_400_BAD_REQUEST)

    profile, _ = Profile.objects.get_or_create(user=request.user)
    tournament = Tournament.objects.create(name=name, creator=profile, max_players=max_players)
    
    # --- blockchain : enregistrer le tournoi ---
    try:
        service.store_tournament(
            tournament.chain_id.int, tournament.name,
            profile.user.username, tournament.max_players,
        )
    except Exception as e:
        print(f"[blockchain] store_tournament KO: {e}")


    TournamentParticipant.objects.create(tournament=tournament, player=profile)
    return Response(TournamentSerializer(tournament).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def tournament_detail(request, tid):
    tournament = get_object_or_404(Tournament, id=tid)
    return Response(TournamentSerializer(tournament).data)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def tournament_blockchain(request, tid):
    tournament = get_object_or_404(Tournament, id=tid)
    try:
        from blockchain import service
        data = service.get_tournament_onchain(tournament.chain_id.int)
    except Exception as e:
        return Response({"error": f"Blockchain indisponible: {e}"},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if data is None:
        return Response({"error": "Ce tournoi n'est pas sur la blockchain"},
                        status=status.HTTP_404_NOT_FOUND)
    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def join_tournament(request, tid):
    tournament = get_object_or_404(Tournament, id=tid)
    if tournament.status != 'pending':
        return Response({"error": "Inscriptions fermées (de toute faacon on voulait pas de toi)"}, status=status.HTTP_400_BAD_REQUEST)
    if tournament.participants.count() >= tournament.max_players:
        return Response({"error": "Tournoi complet"}, status=status.HTTP_400_BAD_REQUEST)

    profile, _ = Profile.objects.get_or_create(user=request.user)
    _, created = TournamentParticipant.objects.get_or_create(tournament=tournament, player=profile)
    if not created:
        return Response({"error": "Déjà inscrit"}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"message": "Inscrit"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def leave_tournament(request, tid):
    tournament = get_object_or_404(Tournament, id=tid)
    if tournament.status != 'pending':
        return Response({"error": "Tournoi déjà démarré  (rentre chez toi c'est mieux)"}, status=status.HTTP_400_BAD_REQUEST)
    profile, _ = Profile.objects.get_or_create(user=request.user)
    if tournament.creator_id == profile.id:
        return Response({"error": "Le créateur ne peut pas quitter son tournoi t'es con ou quoi"}, status=status.HTTP_400_BAD_REQUEST)
    deleted, _ = TournamentParticipant.objects.filter(tournament=tournament, player=profile).delete()
    if not deleted:
        return Response({"error": "Pas inscrit"}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"message": "Désinscrit"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def start_tournament(request, tid):
    tournament = get_object_or_404(Tournament, id=tid)
    if tournament.creator != request.user.profile:
        return Response({"error": "Seul le créateur peut démarrer"}, status=status.HTTP_403_FORBIDDEN)
    if tournament.status != 'pending':
        return Response({"error": "Déjà démarré wsh sayez arrete frr"}, status=status.HTTP_400_BAD_REQUEST)
    if tournament.participants.count() < 2:
        return Response({"error": "Au moins 2 joueurs requis"}, status=status.HTTP_400_BAD_REQUEST)

    create_bracket(tournament)
    return Response(TournamentSerializer(tournament).data, status=status.HTTP_200_OK)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def my_tournament_match(request, tid):
    tournament = get_object_or_404(Tournament, id=tid)
    profile = request.user.profile
    match = tournament.matches.filter(
        status='pending',
    ).filter(models.Q(player1=profile) | models.Q(player2=profile)).order_by('round', 'slot').first()
    if not match:
        return Response({"match_id": None})
    return Response({"match_id": match.id, "round": match.round})


def health(request):
    return JsonResponse({"status":"ok"}, status=200)


def status_view(request):
    """Return simple status JSON with DB connectivity and last backup timestamp.

    - `db`: 'ok' if a DB cursor can be acquired, else 'down'
    - `last_backup`: ISO timestamp of newest file in /backups or null
    """
    result = {
        "app": "transcendence",
        "status": "ok",
        "db": "unknown",
        "last_backup": None,
        "checked_at": timezone.now().isoformat(),
    }

    # Check DB connectivity
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            _ = cursor.fetchone()
        result["db"] = "ok"
    except Exception:
        result["db"] = "down"
        result["status"] = "degraded"

    # Check backups folder (/backups mounted from host)
    backups_dir = "/backups"
    try:
        if os.path.isdir(backups_dir):
            files = [os.path.join(backups_dir, f) for f in os.listdir(backups_dir) if f.startswith("db_")]
            files = [f for f in files if os.path.isfile(f)]
            if files:
                newest = max(files, key=os.path.getmtime)
                result["last_backup"] = datetime.datetime.fromtimestamp(os.path.getmtime(newest), tz=datetime.timezone.utc).isoformat()
    except Exception:
        # ignore backup errors
        pass

    return JsonResponse(result, status=200 if result["db"] == "ok" else 503)