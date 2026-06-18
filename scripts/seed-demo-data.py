#!/usr/bin/env python3
"""Popula o banco RoadHero com dados demo realistas via REST API."""
import json
import os
import random
import urllib.request
from datetime import datetime, timedelta, timezone

URL = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

DEMO_GUARDIOES = [
    "guardiao1@roadhero.demo",
    "guardiao2@roadhero.demo",
    "guardiao3@roadhero.demo",
]


def resolve_user_ids() -> list[str]:
    req = urllib.request.Request(
        f"{URL}/auth/v1/admin/users?per_page=200",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    )
    with urllib.request.urlopen(req) as resp:
        users = json.loads(resp.read().decode()).get("users", [])
    by_email = {u["email"].lower(): u["id"] for u in users if u.get("email")}
    ids = [by_email[e] for e in DEMO_GUARDIOES if e in by_email]
    if not ids:
        raise RuntimeError("Contas guardião não encontradas. Execute scripts/seed-demo-accounts.py primeiro.")
    return ids

CONCESSIONARIAS = [
    {
        "id": "a1000001-0001-4000-8000-000000000001",
        "nome": "AutoBan — BR-050 Sul de Minas",
        "sigla": "AUTOBAN",
        "rodovia": "BR-050",
        "uf": "MG",
        "extensao_km": 156.0,
        "cor": "#1D4ED8",
        "rota": {"nome": "Trecho Sul de Minas", "coordinates": [[-22.52, -46.63], [-22.35, -46.58], [-22.18, -46.52], [-22.02, -46.48], [-21.85, -46.42]], "buffer_metros": 2500},
        "pedagios": [
            {"nome": "Pedágio Pouso Alegre", "km": "km 45", "latitude": -22.25, "longitude": -46.55, "preco_carro_centavos": 1890, "raio_metros": 2000},
            {"nome": "Pedágio Poços de Caldas", "km": "km 98", "latitude": -21.90, "longitude": -46.45, "preco_carro_centavos": 2150, "raio_metros": 2000},
        ],
        "route_points": [(-22.52, -46.63), (-22.35, -46.58), (-22.18, -46.52), (-22.02, -46.48), (-21.85, -46.42)],
    },
    {
        "id": "a1000001-0001-4000-8000-000000000002",
        "nome": "Arteris Fluminense — BR-101",
        "sigla": "ARTERIS",
        "rodovia": "BR-101",
        "uf": "RJ",
        "extensao_km": 498.0,
        "cor": "#059669",
        "rota": {"nome": "Rio-Santos Fluminense", "coordinates": [[-22.98, -43.21], [-22.88, -43.05], [-22.75, -42.85], [-22.62, -42.65], [-22.48, -42.42]], "buffer_metros": 3000},
        "pedagios": [
            {"nome": "Pedágio Niterói", "km": "km 62", "latitude": -22.88, "longitude": -43.10, "preco_carro_centavos": 3200, "raio_metros": 2500},
            {"nome": "Pedágio Cabo Frio", "km": "km 185", "latitude": -22.55, "longitude": -42.42, "preco_carro_centavos": 2850, "raio_metros": 2200},
        ],
        "route_points": [(-22.98, -43.21), (-22.88, -43.05), (-22.75, -42.85), (-22.62, -42.65), (-22.48, -42.42)],
    },
    {
        "id": "a1000001-0001-4000-8000-000000000003",
        "nome": "CCR ViaOeste — BR-116",
        "sigla": "VIAOESTE",
        "rodovia": "BR-116",
        "uf": "SP",
        "extensao_km": 315.0,
        "cor": "#7C3AED",
        "rota": {"nome": "BR-116 Interior Paulista", "coordinates": [[-23.55, -46.95], [-23.38, -46.88], [-23.22, -46.85], [-23.05, -46.75], [-22.88, -46.68]], "buffer_metros": 2500},
        "pedagios": [
            {"nome": "Pedágio Campinas", "km": "km 78", "latitude": -23.22, "longitude": -46.85, "preco_carro_centavos": 2450, "raio_metros": 2000},
            {"nome": "Pedágio Jundiaí", "km": "km 142", "latitude": -22.95, "longitude": -46.72, "preco_carro_centavos": 1980, "raio_metros": 2000},
        ],
        "route_points": [(-23.55, -46.95), (-23.38, -46.88), (-23.22, -46.85), (-23.05, -46.75), (-22.88, -46.68)],
    },
    {
        "id": "a1000001-0001-4000-8000-000000000004",
        "nome": "EcoRodovias — BR-381 Fernão Dias",
        "sigla": "ECO381",
        "rodovia": "BR-381",
        "uf": "MG",
        "extensao_km": 562.0,
        "cor": "#DC2626",
        "rota": {"nome": "Fernão Dias MG", "coordinates": [[-20.05, -44.08], [-19.95, -44.02], [-19.85, -43.96], [-19.75, -43.90], [-19.65, -43.85]], "buffer_metros": 2800},
        "pedagios": [
            {"nome": "Pedágio Betim", "km": "km 210", "latitude": -19.88, "longitude": -43.98, "preco_carro_centavos": 2750, "raio_metros": 2200},
            {"nome": "Pedágio Contagem", "km": "km 380", "latitude": -19.72, "longitude": -43.88, "preco_carro_centavos": 3100, "raio_metros": 2200},
        ],
        "route_points": [(-20.05, -44.08), (-19.95, -44.02), (-19.85, -43.96), (-19.75, -43.90), (-19.65, -43.85)],
    },
    {
        "id": "a1000001-0001-4000-8000-000000000005",
        "nome": "Entrevias — BR-153 Goiás",
        "sigla": "ENTREVIAS",
        "rodovia": "BR-153",
        "uf": "GO",
        "extensao_km": 437.0,
        "cor": "#EA580C",
        "rota": {"nome": "BR-153 Centro-Oeste", "coordinates": [[-16.72, -49.28], [-16.55, -49.10], [-16.38, -48.92], [-16.20, -48.75], [-16.02, -48.58]], "buffer_metros": 2500},
        "pedagios": [
            {"nome": "Pedágio Anápolis", "km": "km 95", "latitude": -16.45, "longitude": -49.05, "preco_carro_centavos": 1650, "raio_metros": 2000},
            {"nome": "Pedágio Goiânia Sul", "km": "km 210", "latitude": -16.18, "longitude": -48.78, "preco_carro_centavos": 1420, "raio_metros": 2000},
        ],
        "route_points": [(-16.72, -49.28), (-16.55, -49.10), (-16.38, -48.92), (-16.20, -48.75), (-16.02, -48.58)],
    },
    {
        "id": "a1000001-0001-4000-8000-000000000006",
        "nome": "Rota das Bandeiras — SP-330",
        "sigla": "RB330",
        "rodovia": "SP-330",
        "uf": "SP",
        "extensao_km": 443.0,
        "cor": "#0891B2",
        "rota": {"nome": "SP-330 Anhanguera-Bandeirantes", "coordinates": [[-23.25, -47.05], [-23.10, -46.92], [-22.95, -46.78], [-22.78, -46.62], [-22.62, -46.48]], "buffer_metros": 2500},
        "pedagios": [
            {"nome": "Pedágio Campinas SP-330", "km": "km 55", "latitude": -23.08, "longitude": -46.90, "preco_carro_centavos": 2280, "raio_metros": 2000},
            {"nome": "Pedágio Limeira", "km": "km 168", "latitude": -22.85, "longitude": -46.58, "preco_carro_centavos": 1890, "raio_metros": 2000},
        ],
        "route_points": [(-23.25, -47.05), (-23.10, -46.92), (-22.95, -46.78), (-22.78, -46.62), (-22.62, -46.48)],
    },
    {
        "id": "a1000001-0001-4000-8000-000000000007",
        "nome": "CCR RioSP — BR-101 Litoral Sul",
        "sigla": "RIOSP",
        "rodovia": "BR-101",
        "uf": "SP",
        "extensao_km": 320.0,
        "cor": "#BE185D",
        "rota": {"nome": "BR-101 Litoral Sul SP", "coordinates": [[-24.02, -46.42], [-23.85, -46.35], [-23.68, -46.28], [-23.52, -46.22], [-23.35, -46.15]], "buffer_metros": 2800},
        "pedagios": [
            {"nome": "Pedágio Bertioga", "km": "km 42", "latitude": -23.85, "longitude": -46.32, "preco_carro_centavos": 3500, "raio_metros": 2500},
            {"nome": "Pedágio Peruíbe", "km": "km 128", "latitude": -23.52, "longitude": -46.20, "preco_carro_centavos": 2650, "raio_metros": 2200},
        ],
        "route_points": [(-24.02, -46.42), (-23.85, -46.35), (-23.68, -46.28), (-23.52, -46.22), (-23.35, -46.15)],
    },
]

EXISTING_CONC = {
    "id": "ed2c9b68-4ee7-40e3-b2bd-17df30762db7",
    "nome": "Concebra — BR-060 Planaltina",
    "sigla": "CONCEBRA",
    "rodovia": "BR-060",
    "uf": "DF",
    "route_points": [(-15.90, -48.10), (-15.87, -48.09), (-15.85, -48.08), (-15.83, -48.06)],
}

CATEGORIAS = [
    "animal_na_pista", "veiculo_parado", "acidente", "objeto_na_pista",
    "incendio", "risco_seguranca", "clima_severo", "suspeita_assalto",
]

DESCRICOES = {
    "animal_na_pista": ["Capivara atravessando a pista", "Cachorro solto na faixa de rolamento", "Veado na pista próximo ao km", "Gado solto na via"],
    "veiculo_parado": ["Caminhão com pneu furado", "Carro parado sem sinalização", "Van com pane mecânica", "Motocicleta no acostamento"],
    "acidente": ["Colisão traseira entre veículos", "Capotamento bloqueando faixa", "Engavetamento com 3 veículos", "Colisão lateral aguardando resgate"],
    "objeto_na_pista": ["Pneu solto na faixa central", "Caixote de madeira na pista", "Lona obstruindo visibilidade", "Ferro de construção na via"],
    "incendio": ["Queimada no canteiro central", "Fumaça densa reduzindo visibilidade", "Vegetação em chamas no acostamento"],
    "risco_seguranca": ["Buraco profundo na pista", "Sinalização apagada em curva", "Defensa metálica danificada", "Iluminação apagada"],
    "clima_severo": ["Neblina densa visibilidade < 50m", "Alagamento parcial da pista", "Chuva forte com aquaplanagem", "Granizo na pista"],
    "suspeita_assalto": ["Pessoa sinalizando veículos suspeito", "Objetos na pista forçando parada", "Movimentação suspeita em viatura"],
}

STATUSES = ["em_analise", "validado", "resolvido", "descartado"]
STATUS_WEIGHTS = [0.25, 0.35, 0.30, 0.10]
GRAVIDADES = ["baixa", "media", "alta", "critica"]
GRAV_WEIGHTS = [0.30, 0.35, 0.25, 0.10]
PONTOS = {"baixa": 10, "media": 25, "alta": 50, "critica": 100}


def api(method: str, path: str, body=None, prefer: str | None = None):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    }
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


def upsert(table: str, rows: list, on_conflict: str = "id"):
    if not rows:
        return
    api("POST", f"{table}?on_conflict={on_conflict}", rows, prefer="resolution=merge-duplicates")


def insert(table: str, rows: list):
    if not rows:
        return
    batch = 50
    for i in range(0, len(rows), batch):
        api("POST", table, rows[i : i + batch])


def patch(table: str, match: str, body: dict):
    api("PATCH", f"{table}?{match}", body)


def point_near(points: list, spread=0.008):
    lat, lng = random.choice(points)
    return lat + random.uniform(-spread, spread), lng + random.uniform(-spread, spread)


def random_outside():
    spots = [(-3.73, -38.52), (-8.05, -34.87), (-12.97, -38.51), (-25.43, -49.27), (-30.03, -51.23), (-1.45, -48.48), (-27.59, -48.55)]
    lat, lng = random.choice(spots)
    return lat + random.uniform(-0.05, 0.05), lng + random.uniform(-0.05, 0.05)


def count_table(table: str) -> int:
    req = urllib.request.Request(
        f"{URL}/rest/v1/{table}?select=id",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
        method="HEAD",
    )
    with urllib.request.urlopen(req) as resp:
        cr = resp.headers.get("Content-Range", "*/0")
        return int(cr.split("/")[-1])


def main():
    existing_conc = count_table("concessionarias")
    if existing_conc < 8:
        print("1. Atualizando concessionária existente...")
        patch("concessionarias", f"id=eq.{EXISTING_CONC['id']}", {
            "nome": EXISTING_CONC["nome"], "sigla": EXISTING_CONC["sigla"], "rodovia": EXISTING_CONC["rodovia"], "uf": "DF",
        })

        print("2. Inserindo concessionárias...")
        upsert("concessionarias", [{k: c[k] for k in ["id", "nome", "sigla", "rodovia", "uf", "extensao_km", "cor"]} for c in CONCESSIONARIAS])

        print("3. Inserindo rotas e pedágios...")
        rotas, pedagios = [], []
        for c in CONCESSIONARIAS:
            rotas.append({"concessionaria_id": c["id"], **c["rota"]})
            for p in c["pedagios"]:
                pedagios.append({"concessionaria_id": c["id"], **p})
        insert("concessionaria_rotas", rotas)
        insert("concessionaria_pedagios", pedagios)

        insert("concessionaria_pedagios", [{
            "concessionaria_id": EXISTING_CONC["id"],
            "nome": "Pedágio Brazlândia", "km": "km 28",
            "latitude": -15.835, "longitude": -48.055,
            "preco_carro_centavos": 980, "raio_metros": 1800,
        }])
    else:
        print(f"Concessionárias já existem ({existing_conc}), pulando cadastro base.")

    print("4. Atualizando perfis...")
    patch("profiles", "id=eq.834b140d-3243-4e78-a89a-f05efae1a1d3", {"cidade": "Brasília", "pontos": 120, "nivel": "Prata"})
    patch("profiles", "id=eq.25e9d4ea-34cc-41bf-b2f5-84c0a2cd238a", {"nome": "Ana Silva", "cidade": "São Paulo", "pontos": 85, "nivel": "Bronze"})
    patch("profiles", "id=eq.d96bf7fa-be78-4c3b-95c1-834d524a5b74", {"nome": "Carlos Mendes", "cidade": "Rio de Janeiro", "pontos": 210, "nivel": "Ouro"})

    print("5. Gerando alertas...")
    now = datetime.now(timezone.utc)
    reports = []
    USERS = resolve_user_ids()

    all_concs = [(EXISTING_CONC["id"], EXISTING_CONC["rodovia"], EXISTING_CONC["route_points"])]
    all_concs += [(c["id"], c["rodovia"], c["route_points"]) for c in CONCESSIONARIAS]

    for conc_id, rodovia, points in all_concs:
        for _ in range(random.randint(12, 18)):
            cat = random.choice(CATEGORIAS)
            status = random.choices(STATUSES, weights=STATUS_WEIGHTS)[0]
            grav = random.choices(GRAVIDADES, weights=GRAV_WEIGHTS)[0] if status != "em_analise" else None
            lat, lng = point_near(points)
            created = now - timedelta(days=random.randint(0, 29), hours=random.randint(0, 23), minutes=random.randint(0, 59))
            row = {
                "user_id": random.choice(USERS),
                "categoria": cat,
                "descricao": random.choice(DESCRICOES[cat]),
                "latitude": round(lat, 6),
                "longitude": round(lng, 6),
                "status": status,
                "rodovia": rodovia,
                "concessionaria_id": conc_id,
                "gravidade": grav,
                "score_ia": round(random.uniform(0.55, 0.98), 2) if grav else None,
                "pontos_concedidos": PONTOS[grav] if status == "validado" and grav else 0,
                "created_at": created.isoformat(),
                "updated_at": created.isoformat(),
            }
            reports.append(row)

    for _ in range(15):
        cat = random.choice(CATEGORIAS)
        status = random.choices(STATUSES, weights=STATUS_WEIGHTS)[0]
        grav = random.choices(GRAVIDADES, weights=GRAV_WEIGHTS)[0] if status != "em_analise" else None
        lat, lng = random_outside()
        created = now - timedelta(days=random.randint(0, 29), hours=random.randint(0, 23))
        row = {
            "user_id": random.choice(USERS),
            "categoria": cat,
            "descricao": random.choice(DESCRICOES[cat]),
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "status": status,
            "rodovia": random.choice(["BR-116", "BR-101", "BR-040", "BR-230", "BR-316"]),
            "concessionaria_id": None,
            "gravidade": grav,
            "score_ia": round(random.uniform(0.55, 0.98), 2) if grav else None,
            "pontos_concedidos": PONTOS[grav] if status == "validado" and grav else 0,
            "created_at": created.isoformat(),
            "updated_at": created.isoformat(),
        }
        reports.append(row)

    print(f"   Inserindo {len(reports)} alertas...")
    insert("reports", reports)

    # Resumo
    counts = {}
    for label, table in [
        ("concessionarias", "concessionarias"),
        ("pedagios", "concessionaria_pedagios"),
        ("rotas", "concessionaria_rotas"),
        ("alertas", "reports"),
    ]:
        counts[label] = count_table(table)

    print("\n=== Banco populado ===")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    print(f"  alertas vinculados: ~{len(reports) - 15}")
    print(f"  alertas nacionais (sem vínculo): ~15")


if __name__ == "__main__":
    main()
