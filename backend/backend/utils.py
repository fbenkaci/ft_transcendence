import os
import hvac

def _read_vault_token():
    candidates = [
        os.environ.get("VAULT_TOKEN"),
        os.environ.get("VAULT_DEV_ROOT_TOKEN_ID"),
        "/run/secrets/vault_token",
        "/secrets_dir/vault_backend_token.txt",
    ]

    for candidate in candidates:
        if not candidate:
            continue
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    token = f.read().strip()
                if token:
                    return token
            except Exception:
                continue
        if isinstance(candidate, str) and candidate.startswith("hvs."):
            return candidate

    return None


def _get_vault_client():
    token = _read_vault_token()
    if not token:
        return None

    try:
        client = hvac.Client(
            url=os.environ.get("VAULT_ADDR", "http://vault:8200"),
            token=token,
        )
        client.is_authenticated()
        return client
    except Exception:
        return None


def get_env_variable(variable_name, default=None):
    env_candidates = []
    if variable_name == "SECRET_KEY":
        env_candidates = ["SECRET_KEY", "DJANGO_SECRET_KEY"]
    elif variable_name == "BLOCKCHAIN_PRIVATE_KEY":
        env_candidates = ["BLOCKCHAIN_PRIVATE_KEY"]
    else:
        env_candidates = [variable_name]

    for name in env_candidates:
        value = os.environ.get(name)
        if value:
            return value

    client = _get_vault_client()
    if client:
        try:
            path = os.environ.get("VAULT_KV_PATH", "transcendance")
            secrets = client.secrets.kv.read_secret_version(path=path)
            data = secrets.get("data", {}).get("data", {}) if secrets else {}
            if variable_name in data:
                return data[variable_name]
        except Exception:
            pass

    return default