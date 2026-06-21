#!/bin/bash

exec > /dev/null 2>&1

sleep 2

ROOT_TOKEN=$(docker logs transcendence-vault 2>&1 | grep "Root Token:" | awk '{print $3}')

export VAULT_TOKEN="$ROOT_TOKEN"
export VAULT_ADDR="http://127.0.0.1:8200"

# echo "Root token récupéré: $VAULT_TOKEN"

# 2) Créer la policy backend (KV v2)
docker exec -i transcendence-vault vault policy write backend-policy - <<EOF
path "secret/data/transcendance" {
  capabilities = ["read"]
}

path "secret/metadata/transcendance" {
  capabilities = ["read"]
}
EOF

# 3) Écrire les secrets initiaux
docker exec transcendence-vault vault kv put secret/transcendance \
  SECRET_KEY="django-insecure-x%2#kbdwbx@o19a^gb*1&edooqdcu(osxzh11l(fknn7v*0hqb"

# 4) Créer un token limité pour le backend
docker exec transcendence-vault vault token create -policy=backend-policy -format=json \
  | jq -r ".auth.client_token" > vault_backend_token.txt

# echo "Token backend généré et écrit dans vault_backend_token.txt"
