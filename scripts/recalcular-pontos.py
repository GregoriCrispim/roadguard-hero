#!/usr/bin/env python3
"""Recalcula pontos_concedidos e profiles.pontos com base nos reportes validados."""
import json
import os
import urllib.error
import urllib.request

URL = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

PONTOS = {"baixa": 30, "media": 60, "alta": 120, "critica": 200}
DEFAULT = 60


def auth_get(path: str):
    req = urllib.request.Request(
        f"{URL}{path}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def rest(method: str, path: str, body=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()}") from e


def nivel(pontos: int) -> str:
    if pontos >= 5001:
        return "Diamante"
    if pontos >= 2001:
        return "Ouro"
    if pontos >= 501:
        return "Prata"
    return "Bronze"


def pontos_gravidade(grav: str | None) -> int:
    return PONTOS.get(grav or "", DEFAULT)


def demo_user_ids() -> list[tuple[str, str]]:
    users = auth_get("/auth/v1/admin/users?per_page=200").get("users", [])
    return [(u["id"], u["email"]) for u in users if u.get("email", "").endswith("@roadhero.demo")]


def main():
    users = demo_user_ids()
    print(f"Recalculando pontos para {len(users)} contas @roadhero.demo...\n")

    for user_id, email in sorted(users, key=lambda x: x[1]):
        reports = rest("GET", f"reports?user_id=eq.{user_id}&select=id,status,gravidade,pontos_concedidos")

        validados = [r for r in reports if r["status"] == "validado"]
        total_pontos = 0
        corrigidos = 0

        for r in validados:
            pts = pontos_gravidade(r.get("gravidade"))
            total_pontos += pts
            if (r.get("pontos_concedidos") or 0) != pts:
                rest("PATCH", f"reports?id=eq.{r['id']}", {"pontos_concedidos": pts})
                corrigidos += 1

        rest("PATCH", f"profiles?id=eq.{user_id}", {
            "pontos": total_pontos,
            "nivel": nivel(total_pontos),
        })

        print(
            f"  {email}: {len(reports)} reportes, {len(validados)} validados → "
            f"{total_pontos} pts ({nivel(total_pontos)}), {corrigidos} reportes corrigidos"
        )

    print("\n✓ Pontuação sincronizada com os reportes validados.")


if __name__ == "__main__":
    main()
