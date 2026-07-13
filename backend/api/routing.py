from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/pong/', consumers.GameConsumer.as_asgi()),
    path('ws/chat/<str:room>/', consumers.ChatConsumer.as_asgi()),
]