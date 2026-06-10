# FIXE.md — Diagnostic et commandes pour lancer Docker

---

## PROBLÈME 0 — Permission Docker (TOUJOURS À FAIRE TOI-MÊME)

**Erreur :**
```
permission denied while trying to connect to the Docker API at unix:///var/run/docker.sock
```

**Cause :** Le socket Docker (`/var/run/docker.sock`) appartient au groupe `docker`.
`table-en4` n'est pas dans ce groupe → toutes les commandes `docker` échouent.

**Commandes à exécuter (nécessite sudo) :**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

- `usermod -aG docker $USER` : ajoute ton user au groupe `docker` de façon permanente
- `newgrp docker` : applique le changement dans le shell courant sans se déconnecter

**Vérification :**
```bash
groups          # "docker" doit apparaître dans la liste
docker ps       # doit répondre sans erreur
```

---

## PROBLÈME 1 — `prometheus_client` manquant dans `backend/requirements.txt`

**Fichier modifié :** `backend/requirements.txt`

**Cause :** `prometheus_client` avait été retiré du fichier requirements lors d'un commit récent.
Or `backend/api/metrics.py` l'importe directement :
```python
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Gauge
```
Et `backend/backend/urls.py` importe ce fichier au démarrage :
```python
from api.metrics import metrics_view
```
Django charge les URLs au boot → `ModuleNotFoundError` → le backend ne démarre pas.

**Fix appliqué :** `prometheus_client` rajouté à la fin de `backend/requirements.txt`.

---

## PROBLÈME 2 — "Erreur de connexion au serveur." à la création de compte

### Cause racine : URLs hardcodées HTTP depuis une page HTTPS (Mixed Content)

Toutes les pages frontend (`signup`, `login`, `account`, `friends`) appelaient le backend
avec des URLs hardcodées de type :
```javascript
fetch("http://127.0.0.1:8000/api/register/", ...)
```

**Pourquoi ça échoue via Docker (nginx HTTPS) :**

Le site est servi en **HTTPS** à `https://localhost:8443` via nginx.
Le navigateur interdit d'envoyer des requêtes **HTTP** depuis une page **HTTPS**
(politique "Mixed Content" — bloqué par tous les navigateurs modernes).
La requête échoue avant même d'atteindre le serveur → `TypeError: Failed to fetch`
→ le `catch` dans le code affiche **"Erreur de connexion au serveur."**

### Cause secondaire : bug `proxy_pass` nginx (trailing slash)

La conf nginx avait un `/` en trop à la fin du `proxy_pass` du backend :
```nginx
# AVANT (bugué)
location /api/ {
    proxy_pass http://backend:8000/;   # supprime le préfixe /api/ avant de forwarder
```

Avec le `/` final, nginx découpe l'URL :
- Requête entrante : `/api/register/`
- nginx calcule : enlève `/api/`, concatène avec `http://backend:8000/`
- Résultat : `http://backend:8000/register/`
- Mais Django attend `/api/register/` → **404**

### Fixes appliqués

**1. `docker/nginx/default.conf`** — suppression du `/` final sur le proxy backend :
```nginx
# APRÈS (corrigé)
location /api/ {
    proxy_pass http://backend:8000;   # préserve le préfixe /api/ complet
```

**2. Toutes les URLs fetch dans le frontend** — remplacement des URLs absolues hardcodées
par des chemins relatifs :

| Fichier | Ancienne URL | Nouvelle URL |
|---|---|---|
| `app/signup/page.tsx` | `http://127.0.0.1:8000/api/register/` | `/api/register/` |
| `app/login/page.tsx` | `http://127.0.0.1:8000/api/login/` | `/api/login/` |
| `app/login/page.tsx` | `http://127.0.0.1:8000/api/login/verify-2fa/` | `/api/login/verify-2fa/` |
| `app/account/page.tsx` | `http://127.0.0.1:8000/api/me/` | `/api/me/` |
| `app/account/page.tsx` | `http://127.0.0.1:8000/api/update_profile/` | `/api/update_profile/` |
| `app/account/page.tsx` | `http://127.0.0.1:8000/api/2fa/enable/` | `/api/2fa/enable/` |
| `app/account/page.tsx` | `http://127.0.0.1:8000/api/2fa/activate/` | `/api/2fa/activate/` |
| `app/account/page.tsx` | `http://127.0.0.1:8000/api/2fa/disable/` | `/api/2fa/disable/` |
| `app/friends/page.tsx` | `http://127.0.0.1:8000/api/friends/` | `/api/friends/` |
| `app/friends/page.tsx` | `http://127.0.0.1:8000/api/friends/requests/` | `/api/friends/requests/` |
| `app/friends/page.tsx` | `http://127.0.0.1:8000/api/friends/request/send/${u}/` | `/api/friends/request/send/${u}/` |
| `app/friends/page.tsx` | `http://127.0.0.1:8000/api/friends/request/respond/${u}/` | `/api/friends/request/respond/${u}/` |
| `app/friends/page.tsx` | `http://127.0.0.1:8000/api/friends/remove/${u}/` | `/api/friends/remove/${u}/` |

**Pourquoi des chemins relatifs :** le navigateur à `https://localhost:8443/signup`
résout `/api/register/` en `https://localhost:8443/api/register/` — même origine,
même protocole → pas de Mixed Content, pas de CORS. Nginx reçoit la requête et
la forwarder correctement à Django via le réseau interne Docker.

---

## Commandes pour lancer le projet (après avoir réglé la permission docker)

```bash
cd /home/table-en4/Transcendence

# Arrêt complet + suppression des volumes (reset à zéro)
docker compose down -v

# Build toutes les images depuis zéro
docker compose build --no-cache

# Lancer tous les services en arrière-plan
docker compose up -d

# Voir les logs en temps réel
docker compose logs -f

# Vérifier l'état de tous les containers
docker compose ps
```

**Accès après lancement :**
- Site complet (nginx HTTPS) : https://localhost:8443
- Backend Django (direct)    : http://localhost:8000
- Grafana (monitoring)       : http://localhost:3000  (admin / admin)
- Prometheus                 : http://localhost:9090

---

## Résumé des services Docker

| Service    | Image / Build       | Port exposé | Rôle                          |
|------------|---------------------|-------------|-------------------------------|
| db         | postgres:16-alpine  | (interne)   | Base de données PostgreSQL    |
| backend    | ./backend           | 8000:8000   | Django ASGI (daphne/channels) |
| frontend   | ./frontend          | (interne)   | Next.js dev server            |
| nginx      | nginx:alpine        | 8443:443    | Reverse proxy HTTPS           |
| prometheus | prom/prometheus     | 9090:9090   | Collecte des métriques        |
| grafana    | grafana/grafana     | 3000:3000   | Dashboard métriques           |

---

## Commandes utiles de debug

```bash
# Logs d'un service spécifique
docker compose logs backend
docker compose logs frontend

# Entrer dans un container en cours d'exécution
docker compose exec backend bash
docker compose exec db psql -U transcendence -d transcendence

# Stopper sans supprimer les volumes
docker compose down

# Reset complet (containers + volumes)
docker compose down -v

# Rebuild + restart d'un seul service
docker compose build backend
docker compose up -d --no-deps backend
```
