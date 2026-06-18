#!/usr/bin/env python3
"""Cria contas demo RoadHero com senha padrão e vínculos de papel/concessionária."""
import json
import os
import urllib.error
import urllib.request

URL = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PASSWORD = "Admin123"

CONCESSIONARIA_IDS = {
    "concebra": "ed2c9b68-4ee7-40e3-b2bd-17df30762db7",
    "autoban": "a1000001-0001-4000-8000-000000000001",
    "arteris": "a1000001-0001-4000-8000-000000000002",
    "viaoeste": "a1000001-0001-4000-8000-000000000003",
    "ecorodovias": "a1000001-0001-4000-8000-000000000004",
    "entrevias": "a1000001-0001-4000-8000-000000000005",
    "bandeiras": "a1000001-0001-4000-8000-000000000006",
    "riosp": "a1000001-0001-4000-8000-000000000007",
}

ACCOUNTS = [
    # Guardiões
    {"email": "guardiao1@roadhero.demo", "nome": "Ana Silva", "cidade": "São Paulo", "roles": ["user"], "pontos": 85, "nivel": "Bronze"},
    {"email": "guardiao2@roadhero.demo", "nome": "Carlos Mendes", "cidade": "Rio de Janeiro", "roles": ["user"], "pontos": 210, "nivel": "Ouro"},
    {"email": "guardiao3@roadhero.demo", "nome": "Marina Costa", "cidade": "Belo Horizonte", "roles": ["user"], "pontos": 45, "nivel": "Bronze"},
    # Concessionárias
    {"email": "concebra@roadhero.demo", "nome": "Operador Concebra", "cidade": "Brasília", "roles": ["concessionaria"], "conc": "concebra", "cargo": "gestor"},
    {"email": "autoban@roadhero.demo", "nome": "Operador AutoBan", "cidade": "Pouso Alegre", "roles": ["concessionaria"], "conc": "autoban", "cargo": "gestor"},
    {"email": "arteris@roadhero.demo", "nome": "Operador Arteris", "cidade": "Niterói", "roles": ["concessionaria"], "conc": "arteris", "cargo": "gestor"},
    {"email": "viaoeste@roadhero.demo", "nome": "Operador ViaOeste", "cidade": "Campinas", "roles": ["concessionaria"], "conc": "viaoeste", "cargo": "gestor"},
    {"email": "ecorodovias@roadhero.demo", "nome": "Operador EcoRodovias", "cidade": "Betim", "roles": ["concessionaria"], "conc": "ecorodovias", "cargo": "gestor"},
    {"email": "entrevias@roadhero.demo", "nome": "Operador Entrevias", "cidade": "Goiânia", "roles": ["concessionaria"], "conc": "entrevias", "cargo": "gestor"},
    {"email": "bandeiras@roadhero.demo", "nome": "Operador Rota Bandeiras", "cidade": "Campinas", "roles": ["concessionaria"], "conc": "bandeiras", "cargo": "gestor"},
    {"email": "riosp@roadhero.demo", "nome": "Operador CCR RioSP", "cidade": "Santos", "roles": ["concessionaria"], "conc": "riosp", "cargo": "gestor"},
    # ABCR
    {"email": "abcr@roadhero.demo", "nome": "Gestor Nacional ABCR", "cidade": "Brasília", "roles": ["abcr"], "pontos": 0, "nivel": "—"},
    {"email": "abcr.analista@roadhero.demo", "nome": "Analista ABCR", "cidade": "São Paulo", "roles": ["abcr"], "pontos": 0, "nivel": "—"},
    # Admin técnico
    {"email": "admin@roadhero.demo", "nome": "Administrador RoadHero", "cidade": "Brasília", "roles": ["admin"], "pontos": 0, "nivel": "—"},
]


def auth_req(method: str, path: str, body=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {path} -> {e.code}: {err}") from e


def rest_req(method: str, path: str, body=None, prefer: str | None = None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {path} -> {e.code}: {err}") from e


def find_user_by_email(email: str) -> dict | None:
    users = auth_req("GET", f"/auth/v1/admin/users?per_page=200").get("users", [])
    for u in users:
        if u.get("email", "").lower() == email.lower():
            return u
    return None


def ensure_user(account: dict) -> str:
    existing = find_user_by_email(account["email"])
    meta = {"nome": account["nome"], "cidade": account.get("cidade", "")}
    if existing:
        user_id = existing["id"]
        auth_req("PUT", f"/auth/v1/admin/users/{user_id}", {
            "password": PASSWORD,
            "email_confirm": True,
            "user_metadata": meta,
        })
        print(f"  ↻ {account['email']} (senha atualizada)")
    else:
        created = auth_req("POST", "/auth/v1/admin/users", {
            "email": account["email"],
            "password": PASSWORD,
            "email_confirm": True,
            "user_metadata": meta,
        })
        user_id = created["id"]
        print(f"  + {account['email']} (criado)")

    patch = {"nome": account["nome"], "cidade": account.get("cidade")}
    if "pontos" in account:
        patch["pontos"] = account["pontos"]
    if "nivel" in account:
        patch["nivel"] = account["nivel"]
    rest_req("PATCH", f"profiles?id=eq.{user_id}", patch)

    for role in account.get("roles", ["user"]):
        rest_req("POST", "user_roles?on_conflict=user_id,role", [{"user_id": user_id, "role": role}], prefer="resolution=merge-duplicates")

    if conc_key := account.get("conc"):
        conc_id = CONCESSIONARIA_IDS[conc_key]
        rest_req("POST", "concessionaria_members?on_conflict=user_id,concessionaria_id", [{
            "user_id": user_id,
            "concessionaria_id": conc_id,
            "cargo": account.get("cargo", "operador"),
        }], prefer="resolution=merge-duplicates")

    return user_id


def main():
    print(f"Criando/atualizando contas demo (senha: {PASSWORD})...\n")
    ids = {}
    for acc in ACCOUNTS:
        ids[acc["email"]] = ensure_user(acc)

    print(f"\n✓ {len(ACCOUNTS)} contas prontas.")
    return ids


if __name__ == "__main__":
    main()
