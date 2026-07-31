#!/usr/bin/env python3
"""Download the licensed benchmark source videos without deriving movement artifacts."""

from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from pathlib import Path


def download_fixture(file_id: str, target: Path) -> None:
    metadata_url = f"https://data.mendeley.com/public-api/datasets/kgbb3yn47p/files/{file_id}"
    request = urllib.request.Request(metadata_url, headers={"User-Agent": "Formie-Benchmark/2.0", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        details = json.load(response)["content_details"]
    if target.exists() and target.stat().st_size == int(details["size"]):
        if hashlib.sha256(target.read_bytes()).hexdigest() == details["sha256_hash"]:
            return
    target.parent.mkdir(parents=True, exist_ok=True)
    download = urllib.request.Request(details["download_url"], headers={"User-Agent": "Formie-Benchmark/2.0"})
    with urllib.request.urlopen(download, timeout=180) as response, target.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if hashlib.sha256(target.read_bytes()).hexdigest() != details["sha256_hash"]:
        raise RuntimeError(f"SHA-256 mismatch for {target.name}")


def main() -> None:
    if len(sys.argv) not in (3, 4):
        raise SystemExit("Usage: python scripts/prepare-video-benchmark.py <manifest.json> <output-directory> [fixture-id,...]")
    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    output = Path(sys.argv[2])
    requested = set(sys.argv[3].split(",")) if len(sys.argv) == 4 else set()
    fixtures = [fixture for fixture in manifest["fixtures"] if not requested or fixture["id"] in requested]
    missing = requested.difference(fixture["id"] for fixture in fixtures)
    if missing:
        raise SystemExit(f"Unknown fixture IDs: {', '.join(sorted(missing))}")
    output.mkdir(parents=True, exist_ok=True)
    for index, fixture in enumerate(fixtures, start=1):
        target = output / f"{fixture['id']}.mp4"
        print(f"[{index}/{len(fixtures)}] {fixture['id']}: source video", flush=True)
        download_fixture(fixture["sourceFileId"], target)
    (output / "benchmark-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
