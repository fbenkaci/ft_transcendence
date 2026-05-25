"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import api.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
	#gngngn ca c'est pour les login profile etc
	"http": django_asgi_app,

	#IMPORTANT ca c'est pour le jeu
	"websocket": AuthMiddlewareStack(
		URLRouter(
			api.routing.websocket_urlpatterns
		)
	),
})
