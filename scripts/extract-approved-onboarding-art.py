"""Extract exact approved raster art for native onboarding screens.

The source captures are the visual source of truth. This script only crops and
makes their dark page background transparent; it never redraws, regenerates,
resizes, sharpens, or paraphrases the approved artwork.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRAME_FREE = ROOT / "assets" / "production" / "onboarding" / "approved-frame-free"
APPROVED = ROOT / "assets" / "production" / "onboarding" / "approved"
OUTPUT = ROOT / "assets" / "production" / "onboarding" / "extracted"
PREMIUM_OUTPUT = OUTPUT / "premium"

# Coordinates are measured against the approved source rasters. They isolate
# only the illustration and exclude device chrome, page copy, and screenshot CTA.
ILLUSTRATION_CROPS = {
    "01-welcome.png": ("01-welcome-illustration.png", (55, 205, 566, 655)),
    "03-product-value.png": ("03-product-value-illustration.png", (0, 445, 621, 1355)),
    "06-why-formie.png": ("06-why-formie-illustration.png", (0, 535, 621, 1245)),
    "09-product-demonstration.png": ("09-product-demonstration-illustration.png", (0, 480, 621, 1365)),
    "14-long-term-value.png": ("14-long-term-value-illustration.png", (0, 480, 621, 1295)),
    "15-loading.png": ("15-loading-illustration.png", (200, 425, 421, 660)),
}

# The premium page uses the exact approved objects as independent decorative
# layers so the price and purchase controls remain native and live.
PREMIUM_CROPS = {
    "dumbbell.png": (0, 110, 335, 370),
    "ball.png": (645, 175, 853, 445),
    "kettlebell.png": (0, 990, 145, 1275),
    "athlete.png": (708, 895, 853, 1210),
    "plate.png": (670, 1360, 853, 1645),
    "bag.png": (490, 1638, 790, 1844),
}


def remove_page_background(image: Image.Image) -> Image.Image:
    """Remove only near-black page pixels with a soft edge transition."""
    result = image.convert("RGBA")
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            luminance = max(red, green, blue)
            if luminance <= 18:
                pixels[x, y] = (red, green, blue, 0)
            elif luminance < 42:
                pixels[x, y] = (red, green, blue, min(alpha, round((luminance - 18) / 24 * 255)))
    return result


def export_crop(source_path: Path, bounds: tuple[int, int, int, int], output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    cropped = source.crop(bounds)
    remove_page_background(cropped).save(output_path, optimize=True)


def extract() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PREMIUM_OUTPUT.mkdir(parents=True, exist_ok=True)

    for source_name, (output_name, bounds) in ILLUSTRATION_CROPS.items():
        export_crop(FRAME_FREE / source_name, bounds, OUTPUT / output_name)

    premium_source = APPROVED / "17-premium.png"
    for output_name, bounds in PREMIUM_CROPS.items():
        export_crop(premium_source, bounds, PREMIUM_OUTPUT / output_name)


if __name__ == "__main__":
    extract()
