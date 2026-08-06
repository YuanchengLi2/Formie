"""Extract the approved onboarding artwork from the archived phone captures.

The crop coordinates deliberately exclude the fake device chrome/navigation and
the screenshot CTA. Pixels that are truly black become transparent so the
approved raster blends into the native black safe-area surface without a frame.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "production" / "onboarding" / "approved-frame-free"
OUTPUT = ROOT / "assets" / "production" / "onboarding" / "extracted"

# source name: (output name, left, top, right, bottom)
CROPS = {
    "01-welcome.png": ("01-welcome-content.png", 20, 140, 601, 1225),
    "03-product-value.png": ("03-product-value-content.png", 20, 250, 601, 1400),
    "06-why-formie.png": ("06-why-formie-content.png", 20, 250, 601, 1400),
    "09-product-demonstration.png": ("09-product-demonstration-content.png", 20, 250, 601, 1400),
    "14-long-term-value.png": ("14-long-term-value-content.png", 20, 250, 601, 1400),
    "15-loading.png": ("15-loading-content.png", 20, 160, 601, 1250),
}


def extract() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source_name, (output_name, left, top, right, bottom) in CROPS.items():
        source = Image.open(SOURCE / source_name).convert("RGBA")
        image = source.crop((left, top, right, bottom))
        pixels = image.load()
        for y in range(image.height):
            for x in range(image.width):
                red, green, blue, alpha = pixels[x, y]
                if max(red, green, blue) <= 5:
                    pixels[x, y] = (red, green, blue, 0)
                elif max(red, green, blue) <= 12:
                    pixels[x, y] = (red, green, blue, min(alpha, (max(red, green, blue) - 5) * 36))
        image.save(OUTPUT / output_name, optimize=True)


if __name__ == "__main__":
    extract()
