CLEAN_DIRS = frontend/node_modules frontend/.next backend/env

.PHONY: all front back

all:
	@echo "on lance le front et le back gngngn"
	@make -j 2 front back

front:
	@echo "le front run sur le port 3000"
	cd frontend && npm run dev

back:
	@echo "le back run sur le port 8000"
	cd backend && ./env/bin/python manage.py runserver 0.0.0.0:8000

install:
	@echo "installation des dépendences frontend gngngn"
	cd frontend && npm install
	@echo "installation des dépendences du backend gngnng"
	cd backend && python3 -m venv env && ./env/bin/pip install django djangorestframework django-cors-headers djangorestframework-simplejwt Pillow pyotp channels daphne

fclean:
	@echo "Nettoyage complet..."
	@rm -rf $(CLEAN_DIRS)
	@find . -name "*.pyc" -exec rm -f {} +
	@find . -name "__pycache__" -exec rm -rf {} +
	@echo "Nettoyage terminé. Il ne reste que le code source."

re: fclean all
