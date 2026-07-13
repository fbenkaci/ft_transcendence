FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Dépendances système
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier requirements AVANT installation
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# On force les migrations sur l'app "api" spécifiquement, tout est automatique
CMD ["sh", "-c", "python manage.py makemigrations api && python manage.py migrate && daphne -b 0.0.0.0 -p 8000 backend.asgi:application"]