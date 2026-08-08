"""Create a high-density copy of the exact approved paywall avatar strip."""

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "production" / "paywall" / "social-proof-avatars.png"
OUTPUT = ROOT / "assets" / "production" / "paywall" / "social-proof-avatars-hd.png"


def upscale() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    enlarged = source.resize((source.width * 4, source.height * 4), Image.Resampling.LANCZOS)
    sharpened = enlarged.filter(ImageFilter.UnsharpMask(radius=1.1, percent=125, threshold=2))
    sharpened.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    upscale()
