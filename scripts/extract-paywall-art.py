"""Extract the supplied paywall's social-proof artwork."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "production" / "paywall" / "reference" / "paywall-reference.png"
OUTPUT = ROOT / "assets" / "production" / "paywall" / "social-proof-avatars.png"


def extract() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    # The four overlapping avatars in the supplied 507x881 reference.
    image.crop((24, 455, 190, 526)).save(OUTPUT, optimize=True)


if __name__ == "__main__":
    extract()
