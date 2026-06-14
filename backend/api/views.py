from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
import pyotp
from .models import Profile, FriendRequest
import os
from django.db import connection
from django.utils import timezone
import datetime

@api_view(['POST'])
@permission_classes([AllowAny])
def RegisterView(request):
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username déjà pris"}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(username=username, email=email, password=password)
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
    user = get_object_or_404(User, username=username)
    profile = user.profile
    
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
        "avatar_url": request.build_absolute_uri(profile.avatar.url) if profile.avatar else None,
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
            return Response({"error": "Ancien mot de passe incorrect"}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()

    if avatar:
        profile, created = Profile.objects.get_or_create(user=user)
        profile.avatar = avatar
        profile.save()
        return Response({
            "message": "Profil mis à jour", 
            "avatar_url": request.build_absolute_uri(profile.avatar.url)
        }, status=status.HTTP_200_OK)

    return Response({"message": "Profil mis à jour"}, status=status.HTTP_200_OK)

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
    return Response({"error": "Code invalide. Réessaye."}, status=status.HTTP_400_BAD_REQUEST)

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
            "avatar_url": request.build_absolute_uri(friend.avatar.url) if friend.avatar else None
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
        return Response({"error": "Tu ne peux pas t'ajouter toi-même."}, status=status.HTTP_400_BAD_REQUEST)

    if receiver_profile in sender_profile.friends.all():
        return Response({"error": "Vous êtes déjà amis."}, status=status.HTTP_400_BAD_REQUEST)

    if FriendRequest.objects.filter(sender=sender_profile, receiver=receiver_profile).exists():
        return Response({"error": "Demande déjà envoyée en attente."}, status=status.HTTP_400_BAD_REQUEST)

    if FriendRequest.objects.filter(sender=receiver_profile, receiver=sender_profile).exists():
        return Response({"error": f"{username} t'a déjà envoyé une demande. Accepte-la !"}, status=status.HTTP_400_BAD_REQUEST)

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
        return Response({"message": f"Demande de {username} refusée."}, status=status.HTTP_200_OK)
    else:
        return Response({"error": "Action invalide."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def remove_friend(request, username):
    user_profile = request.user.profile
    target_user = get_object_or_404(User, username=username)
    target_profile = target_user.profile

    if target_profile in user_profile.friends.all():
        user_profile.friends.remove(target_profile)
        return Response({"message": f"{username} retiré de tes amis."}, status=status.HTTP_200_OK)
    return Response({"error": "Cet utilisateur n'est pas ton ami."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_friend_requests(request):
    requests = FriendRequest.objects.filter(receiver=request.user.profile)
    data = [{
        "username": req.sender.user.username,
        "avatar_url": request.build_absolute_uri(req.sender.avatar.url) if req.sender.avatar else None
    } for req in requests]
    return Response({"requests": data}, status=status.HTTP_200_OK)

from django.http import JsonResponse
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