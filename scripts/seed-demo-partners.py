#!/usr/bin/env python3
"""Seed parceiros demo com recompensas vinculadas."""
import json
import os
import urllib.error
import urllib.request

URL = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PASSWORD = "Admin123"

PARTNERS = [
    {
        "id": "b2000001-0001-4000-8000-000000000001",
        "nome_fantasia": "Posto Estrada Real",
        "razao_social": "Posto Estrada Real Ltda",
        "cnpj": "12.345.678/0001-90",
        "cidade": "Betim",
        "uf": "MG",
        "categoria": "combustivel",
        "descricao": "Rede de postos na BR-381 com descontos para guardiões.",
        "gestor_email": "posto@roadhero.demo",
        "func_email": "funcionario.posto@roadhero.demo",
        "rewards": [
            {"nome": "R$ 10 em combustível", "descricao": "Abasteça e ganhe R$ 10 de desconto.", "custo_pontos": 500, "categoria": "combustivel"},
            {"nome": "Lavagem grátis", "descricao": "Lavagem simples em postos credenciados.", "custo_pontos": 350, "categoria": "combustivel"},
        ],
    },
    {
        "id": "b2000001-0001-4000-8000-000000000002",
        "nome_fantasia": "Restaurante Via Sul",
        "razao_social": "Via Sul Alimentação S/A",
        "cnpj": "98.765.432/0001-10",
        "cidade": "Campinas",
        "uf": "SP",
        "categoria": "alimentacao",
        "descricao": "Restaurantes em rodovias do interior paulista.",
        "gestor_email": "restaurante@roadhero.demo",
        "func_email": "funcionario.restaurante@roadhero.demo",
        "rewards": [
            {"nome": "Café grátis na estrada", "descricao": "Café expresso ou capuccino.", "custo_pontos": 200, "categoria": "alimentacao"},
            {"nome": "15% no almoço", "descricao": "Desconto no prato executivo.", "custo_pontos": 600, "categoria": "alimentacao"},
        ],
    },
    {
        "id": "b2000001-0001-4000-8000-000000000003",
        "nome_fantasia": "TAG Rodovia Fácil",
        "razao_social": "Rodovia Fácil Pagamentos",
        "cnpj": "11.222.333/0001-44",
        "cidade": "Brasília",
        "uf": "DF",
        "categoria": "pedagio",
        "descricao": "Cashback em pedágios para usuários RoadHero.",
        "gestor_email": "pedagio@roadhero.demo",
        "func_email": "funcionario.pedagio@roadhero.demo",
        "rewards": [
            {"nome": "R$ 10 cashback pedágio", "descricao": "Crédito automático na TAG.", "custo_pontos": 500, "categoria": "pedagio"},
        ],
    },
]


def rest(method, path, body=None, prefer=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else []


def auth_get_users():
    req = urllib.request.Request(
        f"{URL}/auth/v1/admin/users?per_page=200",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    )
    with urllib.request.urlopen(req) as resp:
        users = json.loads(resp.read().decode()).get("users", [])
    return {u["email"].lower(): u["id"] for u in users if u.get("email")}


def ensure_user(email: str, nome: str, cidade: str) -> str:
    users = auth_get_users()
    if email in users:
        uid = users[email]
        urllib.request.urlopen(urllib.request.Request(
            f"{URL}/auth/v1/admin/users/{uid}",
            data=json.dumps({"password": PASSWORD, "email_confirm": True, "user_metadata": {"nome": nome, "cidade": cidade}}).encode(),
            headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
            method="PUT",
        ))
    else:
        created = json.loads(urllib.request.urlopen(urllib.request.Request(
            f"{URL}/auth/v1/admin/users",
            data=json.dumps({"email": email, "password": PASSWORD, "email_confirm": True, "user_metadata": {"nome": nome, "cidade": cidade}}).encode(),
            headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
            method="POST",
        )).read().decode())
        uid = created["id"]
    rest("PATCH", f"profiles?id=eq.{uid}", {"nome": nome, "cidade": cidade})
    rest("POST", "user_roles?on_conflict=user_id,role", [{"user_id": uid, "role": "partner"}], prefer="resolution=merge-duplicates")
    return uid


def main():
    print("Seed parceiros demo...")
    by_email = auth_get_users()

    for p in PARTNERS:
        rest("POST", "partners?on_conflict=id", [{
            "id": p["id"],
            "nome_fantasia": p["nome_fantasia"],
            "razao_social": p["razao_social"],
            "cnpj": p["cnpj"],
            "cidade": p["cidade"],
            "uf": p["uf"],
            "categoria": p["categoria"],
            "descricao": p["descricao"],
            "ativo": True,
        }], prefer="resolution=merge-duplicates")

        gestor_id = ensure_user(p["gestor_email"], f"Gestor {p['nome_fantasia']}", p["cidade"])
        func_id = ensure_user(p["func_email"], f"Funcionário {p['nome_fantasia']}", p["cidade"])

        for uid, cargo in [(gestor_id, "gestor"), (func_id, "funcionario")]:
            rest("POST", "partner_members?on_conflict=user_id,partner_id", [{
                "user_id": uid, "partner_id": p["id"], "cargo": cargo,
            }], prefer="resolution=merge-duplicates")

        for r in p["rewards"]:
            rest("POST", "rewards", {
                "partner_id": p["id"],
                "nome": r["nome"],
                "descricao": r["descricao"],
                "custo_pontos": r["custo_pontos"],
                "categoria": r["categoria"],
                "ativo": True,
            })

        print(f"  ✓ {p['nome_fantasia']} — {p['gestor_email']} / {p['func_email']}")

    # Desativar recompensas legadas sem parceiro
    rest("PATCH", "rewards?partner_id=is.null", {"ativo": False})
    print("\n✓ Parceiros e recompensas prontos.")


if __name__ == "__main__":
    main()
