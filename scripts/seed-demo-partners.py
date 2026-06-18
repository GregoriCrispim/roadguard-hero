#!/usr/bin/env python3
"""Seed parceiros demo com recompensas vinculadas (sem pedágio/cashback)."""
import json
import os
import urllib.request

URL = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PASSWORD = "Admin123"

# Regra de negócio: não é permitido desconto em pedágio nem cashback de pedágio.
PARTNERS = [
    {
        "id": "b2000001-0001-4000-8000-000000000001",
        "nome_fantasia": "Posto Estrada Real",
        "razao_social": "Posto Estrada Real Ltda",
        "cnpj": "12.345.678/0001-90",
        "cidade": "Betim",
        "uf": "MG",
        "categoria": "combustivel",
        "descricao": "Rede de postos na BR-381 com benefícios para guardiões RoadHero.",
        "gestor_email": "posto@roadhero.demo",
        "funcionarios": [
            ("funcionario.posto@roadhero.demo", "Atendente Posto Estrada Real"),
            ("caixa.posto@roadhero.demo", "Caixa Posto Estrada Real"),
        ],
        "rewards": [
            {"nome": "R$ 15 em combustível", "descricao": "Desconto direto no abastecimento acima de 30 litros.", "custo_pontos": 500, "categoria": "combustivel"},
            {"nome": "Lavagem simples grátis", "descricao": "Lavagem externa em postos credenciados da rede.", "custo_pontos": 350, "categoria": "combustivel"},
            {"nome": "Calibragem de pneus grátis", "descricao": "Calibragem e checagem visual dos pneus.", "custo_pontos": 150, "categoria": "combustivel"},
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
        "funcionarios": [
            ("funcionario.restaurante@roadhero.demo", "Atendente Via Sul"),
            ("cozinha.restaurante@roadhero.demo", "Equipe Via Sul"),
        ],
        "rewards": [
            {"nome": "Café grátis na estrada", "descricao": "Café expresso ou capuccino pequeno.", "custo_pontos": 200, "categoria": "alimentacao"},
            {"nome": "15% no almoço executivo", "descricao": "Desconto no prato do dia com sobremesa.", "custo_pontos": 600, "categoria": "alimentacao"},
            {"nome": "Suco natural grátis", "descricao": "Suco de laranja ou limão com qualquer refeição.", "custo_pontos": 120, "categoria": "alimentacao"},
        ],
    },
    {
        "id": "b2000001-0001-4000-8000-000000000004",
        "nome_fantasia": "Conveniência Rodo Express",
        "razao_social": "Rodo Express Comércio Ltda",
        "cnpj": "22.333.444/0001-55",
        "cidade": "Jundiaí",
        "uf": "SP",
        "categoria": "conveniencia",
        "descricao": "Lojas de conveniência em áreas de serviço rodoviária.",
        "gestor_email": "conveniencia@roadhero.demo",
        "funcionarios": [
            ("funcionario.conveniencia@roadhero.demo", "Atendente Rodo Express"),
        ],
        "rewards": [
            {"nome": "Kit viagem (água + snack)", "descricao": "Água 500 ml + barra de cereal ou castanhas.", "custo_pontos": 180, "categoria": "alimentacao"},
            {"nome": "Isotônico Gatorade grátis", "descricao": "Garrafa 500 ml à escolha.", "custo_pontos": 100, "categoria": "alimentacao"},
            {"nome": "10% em compras acima de R$ 40", "descricao": "Válido em toda a loja, exceto cigarros.", "custo_pontos": 250, "categoria": "alimentacao"},
        ],
    },
    {
        "id": "b2000001-0001-4000-8000-000000000005",
        "nome_fantasia": "Auto Center Rodovia",
        "razao_social": "Auto Center Rodovia Serviços ME",
        "cnpj": "33.444.555/0001-66",
        "cidade": "Pouso Alegre",
        "uf": "MG",
        "categoria": "servicos",
        "descricao": "Oficina e borracharia em postos de serviço da BR-050.",
        "gestor_email": "autocenter@roadhero.demo",
        "funcionarios": [
            ("funcionario.autocenter@roadhero.demo", "Mecânico Auto Center"),
            ("borracheiro.autocenter@roadhero.demo", "Borracheiro Auto Center"),
        ],
        "rewards": [
            {"nome": "Checagem de fluidos grátis", "descricao": "Óleo, água, freio e palhetas — inspeção rápida.", "custo_pontos": 200, "categoria": "servicos"},
            {"nome": "Balanceamento com 20% off", "descricao": "Balanceamento de até 4 rodas.", "custo_pontos": 450, "categoria": "servicos"},
            {"nome": "Troca de lâmpada grátis", "descricao": "Mão de obra grátis na troca (lâmpada por conta do cliente).", "custo_pontos": 150, "categoria": "servicos"},
        ],
    },
    {
        "id": "b2000001-0001-4000-8000-000000000006",
        "nome_fantasia": "Rede Descanso & Cia",
        "razao_social": "Descanso & Cia Hotéis Rodoviários",
        "cnpj": "44.555.666/0001-77",
        "cidade": "Goiânia",
        "uf": "GO",
        "categoria": "hospedagem",
        "descricao": "Salas de descanso e pernoite para caminhoneiros e viajantes.",
        "gestor_email": "descanso@roadhero.demo",
        "funcionarios": [
            ("funcionario.descanso@roadhero.demo", "Recepcionista Descanso & Cia"),
        ],
        "rewards": [
            {"nome": "20% na diária de descanso (2h)", "descricao": "Sala com chuveiro e descanso de 2 horas.", "custo_pontos": 400, "categoria": "hospedagem"},
            {"nome": "Café da manhã cortesia", "descricao": "Café, pão e fruta no pernoite.", "custo_pontos": 300, "categoria": "hospedagem"},
        ],
    },
    {
        "id": "b2000001-0001-4000-8000-000000000007",
        "nome_fantasia": "RoadHero Store",
        "razao_social": "RoadHero Merchandising Ltda",
        "cnpj": "55.666.777/0001-88",
        "cidade": "São Paulo",
        "uf": "SP",
        "categoria": "brinde",
        "descricao": "Loja oficial de brindes e kits do programa Guardião.",
        "gestor_email": "loja@roadhero.demo",
        "funcionarios": [
            ("funcionario.loja@roadhero.demo", "Atendente RoadHero Store"),
        ],
        "rewards": [
            {"nome": "Kit Guardião RoadHero", "descricao": "Camiseta + adesivo + squeeze oficial.", "custo_pontos": 1500, "categoria": "brinde"},
            {"nome": "Adesivo exclusivo Guardião", "descricao": "Adesivo refletivo para veículo.", "custo_pontos": 80, "categoria": "brinde"},
            {"nome": "Boné RoadHero", "descricao": "Boné oficial do programa.", "custo_pontos": 600, "categoria": "brinde"},
        ],
    },
]

REMOVED_PARTNER_ID = "b2000001-0001-4000-8000-000000000003"  # antigo TAG pedágio


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
    print("Seed parceiros demo (sem pedágio/cashback)...\n")

    # Desativar parceiro antigo de pedágio e suas recompensas
    rest("PATCH", f"partners?id=eq.{REMOVED_PARTNER_ID}", {"ativo": False})
    rest("PATCH", f"rewards?partner_id=eq.{REMOVED_PARTNER_ID}", {"ativo": False})
    # Desativar qualquer recompensa de pedágio/cashback
    all_rewards = rest("GET", "rewards?select=id,nome,categoria")
    for reward in all_rewards:
        nome = (reward.get("nome") or "").lower()
        cat = reward.get("categoria") or ""
        if cat == "pedagio" or "pedagio" in nome or "pedágio" in nome or "cashback" in nome:
            rest("PATCH", f"rewards?id=eq.{reward['id']}", {"ativo": False})

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
        rest("POST", "partner_members?on_conflict=user_id,partner_id", [{
            "user_id": gestor_id, "partner_id": p["id"], "cargo": "gestor",
        }], prefer="resolution=merge-duplicates")

        func_emails = []
        for email, nome in p["funcionarios"]:
            fid = ensure_user(email, nome, p["cidade"])
            rest("POST", "partner_members?on_conflict=user_id,partner_id", [{
                "user_id": fid, "partner_id": p["id"], "cargo": "funcionario",
            }], prefer="resolution=merge-duplicates")
            func_emails.append(email)

        # Substituir recompensas do parceiro (evita duplicatas ao re-rodar)
        rest("DELETE", f"rewards?partner_id=eq.{p['id']}")
        for r in p["rewards"]:
            rest("POST", "rewards", {
                "partner_id": p["id"],
                "nome": r["nome"],
                "descricao": r["descricao"],
                "custo_pontos": r["custo_pontos"],
                "categoria": r["categoria"],
                "ativo": True,
            })

        print(f"  ✓ {p['nome_fantasia']}")
        print(f"      gestor: {p['gestor_email']}")
        for e in func_emails:
            print(f"      funcionário: {e}")
        print(f"      {len(p['rewards'])} recompensas")

    rest("PATCH", "rewards?partner_id=is.null", {"ativo": False})
    print("\n✓ Parceiros cadastrados. Pedágio/cashback desativados.")


if __name__ == "__main__":
    main()
