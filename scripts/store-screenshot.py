"""Compose a side-panel screenshot into a Chrome Web Store listing image.

Usage:
    python scripts/store-screenshot.py path/to/panel.png [output.png]

Output defaults to store-assets/screenshot-1280x800.png (1280x800).
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

CANVAS_W, CANVAS_H = 1280, 800
PADDING = 48
PANEL_MAX_H = 720
PANEL_MAX_W = 420
RADIUS = 18
SHADOW_OFFSET = (10, 14)

root = Path(__file__).resolve().parent.parent


def rounded(src: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", src.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, src.width - 1, src.height - 1), radius=radius, fill=255)
    out = Image.new("RGBA", src.size)
    out.paste(src, (0, 0), mask)
    return out


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    panel_path = Path(sys.argv[1])
    out_path = root / (sys.argv[2] if len(sys.argv) > 2 else "store-assets/screenshot-1280x800.png")

    panel = Image.open(panel_path).convert("RGBA")

    scale = min(PANEL_MAX_H / panel.height, PANEL_MAX_W / panel.width, 1.0)
    panel = panel.resize(
        (max(1, round(panel.width * scale)), max(1, round(panel.height * scale))),
        Image.LANCZOS,
    )

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (245, 245, 243, 255))

    # Shadow layer behind the panel.
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sh = ImageDraw.Draw(shadow)
    x = CANVAS_W - PADDING - panel.width
    y = (CANVAS_H - panel.height) // 2
    sh.rounded_rectangle(
        (x + SHADOW_OFFSET[0], y + SHADOW_OFFSET[1], x + panel.width + SHADOW_OFFSET[0],
         y + panel.height + SHADOW_OFFSET[1]),
        radius=RADIUS + 8,
        fill=(0, 0, 0, 46),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas.alpha_composite(shadow)

    # Panel itself with rounded corners.
    canvas.alpha_composite(rounded(panel, RADIUS), (x, y))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path)
    print(f"Saved {out_path} ({canvas.width}x{canvas.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
