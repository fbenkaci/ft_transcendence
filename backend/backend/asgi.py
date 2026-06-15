"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django_asgi_app = get_asgi_application()

from api.jwt_middleware import JWTAuthMiddleware
import api.routing

application = ProtocolTypeRouter({
	#gngngn ca c'est pour les login profile etc
	"http": django_asgi_app,

	#IMPORTANT ca c'est pour le jeu
	"websocket": JWTAuthMiddleware(
		URLRouter(
			api.routing.websocket_urlpatterns
		)
	),
})
