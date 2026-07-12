.PHONY: all install build up start stop down restart logs

all: up

install:
	@echo "Installation des dépendances frontend et backend gngngn"
	cd frontend && npm install
	cd backend && python3 -m venv env && ./env/bin/pip install -r requirements.txt

build:
	docker compose build

up:
	docker compose up -d

start:
	docker compose start

stop:
	docker compose stop

down:
	docker compose down --volumes --remove-orphans

restart: down up

logs:
	docker compose logs -f
