from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.response import Response
from rest_framework import status
from .models import Profile
from django.contrib.auth.models import User

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

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    user = request.user
    profile, _ = Profile.objects.get_or_create(user=user)
    return Response({
        "username": user.username,
        "email": user.email,
        "avatar_url": request.build_absolute_uri(profile.avatar.url) if profile.avatar else None
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
