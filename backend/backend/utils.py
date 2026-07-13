import hvac
import os

with open("/run/secrets/vault_token", "r") as f:
    VAULT_TOKEN = f.read().strip()

# Initialiser le client Vault
client = hvac.Client(
    url="http://vault:8200",
    token=VAULT_TOKEN
)

def get_env_variable(variable_name):
  secrets = client.secrets.kv.read_secret_version(path="transcendance")
  if not secrets:
    return None
  variables = secrets.get("data", {}).get("data", {})
  return variables.get(variable_name)