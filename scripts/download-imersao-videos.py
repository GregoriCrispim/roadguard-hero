#!/usr/bin/env python3
"""Baixa os vídeos da jornada Imersão do Google Drive público."""
import subprocess
import sys

FOLDER_URL = "https://drive.google.com/drive/folders/1kIl-ttZx1E_SMF9i0uOgAnMr0MgRvIsW"
OUTPUT = "public/videos"


def main() -> None:
    try:
        subprocess.run(
            [sys.executable, "-m", "gdown", "--folder", FOLDER_URL, "-O", OUTPUT],
            check=True,
        )
    except subprocess.CalledProcessError as e:
        print("Instale gdown: pip install gdown", file=sys.stderr)
        raise SystemExit(e.returncode) from e
    print(f"✓ Vídeos salvos em {OUTPUT}/")


if __name__ == "__main__":
    main()
