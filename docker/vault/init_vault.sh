#!/bin/bash

exec > /dev/null 2>&1

sleep 2

ROOT_TOKEN=$(docker logs transcendence-vault 2>&1 | grep "Root Token:" | awk '{print $3}')

export VAULT_TOKEN="$ROOT_TOKEN"
export VAULT_ADDR="http://127.0.0.1:8200"


docker exec -i transcendence-vault vault policy write backend-policy - <<EOF
path "secret/data/transcendance" {
  capabilities = ["read"]
}

path "secret/metadata/transcendance" {
  capabilities = ["read"]
}
EOF

docker exec transcendence-vault vault kv put secret/transcendance \
  SECRET_KEY="django-insecure-x%2#kbdwbx@o19a^gb*1&edooqdcu(osxzh11l(fknn7v*0hqb" \
  BLOCKCHAIN_PRIVATE_KEY="78d3fadc2016e906e03055656e64373710a215232a8feaacd54b07962f64de7f"

docker exec transcendence-vault vault token create -policy=backend-policy -format=json \
  | jq -r ".auth.client_token" > vault_backend_token.txt
