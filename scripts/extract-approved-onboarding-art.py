"""Export the approved phone-free onboarding artwork for native screens.

The reference-artwork PNGs are already isolated from the phone screenshot
chrome. This script only applies deterministic tight crops, background cleanup,
density resizing, and light sharpening; it never redraws the artwork.
"""

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
REFERENCE_ARTWORK = ROOT / "assets" / "production" / "onboarding" / "reference-artwork"
LEGACY_ARTWORK = ROOT / "assets" / "production" / "onboarding" / "approved-original"
OUTPUT = ROOT / "assets" / "production" / "onboarding" / "extracted"

# Coordinates are measured against the phone-free reference rasters. They
# remove only stray reference-page copy or empty margins around the artwork.
ILLUSTRATION_CROPS = {
    "01-welcome.png": ("01-welcome-illustration.png", (130, 300, 723, 1000), 1024),
    "product-value.png": ("03-product-value-illustration.png", (0, 0, 621, 875), 1024),
    "personalized-coaching.png": ("06-why-formie-illustration.png", (0, 0, 621, 720), 1024),
    "analysis-demonstration.png": ("09-product-demonstration-illustration.png", (0, 55, 621, 925), 1024),
    "progress-history.png": ("14-long-term-value-illustration.png", (0, 0, 621, 825), 1024),
    "15-loading.png": ("15-loading-illustration.png", (274, 539, 578, 837), 512),
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


def export_crop(source_path: Path, bounds: tuple[int, int, int, int], output_path: Path, target_width: int) -> None:
    source = Image.open(source_path).convert("RGBA")
    cropped = remove_page_background(source.crop(bounds))
    target_height = round(cropped.height * target_width / cropped.width)
    density_ready = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
    density_ready = density_ready.filter(ImageFilter.UnsharpMask(radius=0.8, percent=115, threshold=3))
    density_ready.save(output_path, optimize=True)


def extract() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source_name, (output_name, bounds, target_width) in ILLUSTRATION_CROPS.items():
        source_root = LEGACY_ARTWORK if source_name in {"01-welcome.png", "15-loading.png"} else REFERENCE_ARTWORK
        export_crop(source_root / source_name, bounds, OUTPUT / output_name, target_width)


if __name__ == "__main__":
    extract()
