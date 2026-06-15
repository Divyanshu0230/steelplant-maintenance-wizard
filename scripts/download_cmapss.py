#!/usr/bin/env python3
"""Download NASA C-MAPSS turbofan engine dataset (FD001) for predictive maintenance."""

import ssl
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "cmapss"

# Public mirrors of NASA C-MAPSS FD001 (turbofan engine degradation simulation)
MIRRORS = [
    "https://huggingface.co/datasets/SoyVitou/NASA-C-MAPSS-Turbofan-Engine/resolve/main/data/train_FD001.txt",
    "https://raw.githubusercontent.com/wafaaelhosainy/Remaining-Useful-Life-Prediction/main/CMAPSSData/train_FD001.txt",
    "https://raw.githubusercontent.com/ashishpatel26/Turbofan-Engine-Degradation-Simulation/master/CMAPSSData/train_FD001.txt",
]

FILES = {
    "train_FD001.txt": MIRRORS,
    "test_FD001.txt": [
        "https://huggingface.co/datasets/SoyVitou/NASA-C-MAPSS-Turbofan-Engine/resolve/main/data/test_FD001.txt",
    ],
    "RUL_FD001.txt": [
        "https://huggingface.co/datasets/SoyVitou/NASA-C-MAPSS-Turbofan-Engine/resolve/main/data/RUL_FD001.txt",
    ],
}


def download_file(name: str, urls: list[str], dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"  ✓ {name} already exists ({dest.stat().st_size // 1024} KB)")
        return True
    for url in urls:
        try:
            print(f"  Downloading {name} from {url[:60]}...")
            ctx = ssl.create_default_context()
            try:
                import certifi
                ctx.load_verify_locations(certifi.where())
                with urllib.request.urlopen(url, context=ctx, timeout=120) as resp:
                    dest.write_bytes(resp.read())
            except Exception:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                with urllib.request.urlopen(url, context=ctx, timeout=120) as resp:
                    dest.write_bytes(resp.read())
            if dest.stat().st_size > 1000:
                print(f"  ✓ Saved {name} ({dest.stat().st_size // 1024} KB)")
                return True
        except Exception as exc:
            print(f"  ✗ Failed: {exc}")
    return False


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Downloading NASA C-MAPSS dataset (FD001)...")
    print("Source: NASA Prognostics Data Repository — turbofan engine simulation")
    print(f"Target: {OUT_DIR}\n")

    ok = True
    for filename, urls in FILES.items():
        if not download_file(filename, urls, OUT_DIR / filename):
            if filename == "train_FD001.txt":
                ok = False
                print(f"\nERROR: Could not download {filename}. Check internet connection.")
            else:
                print(f"  (optional) {filename} not downloaded — train file is sufficient")

    if ok:
        print("\nC-MAPSS download complete. Next steps:")
        print("  python scripts/seed_data.py      # imports real sensor data")
        print("  python scripts/train_models.py   # trains ML on C-MAPSS")
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
