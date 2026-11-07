"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 6d7efeacf02569fc3f35943f615f1ad9c3656f542785dd16927228a9fada7d00
Renamed to: scripts/generate_icons_pillow.py
Personal machine paths were removed. Cookbook PDFs are not stored in this repository.
Historical one-off tool: scripts that write recipes.json will replace the published dataset.
"""
import os

def _repo_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def _pdf_dir():
    path = os.environ.get("LEAN_BULKING_PDF_DIR", "").strip()
    if not path:
        raise SystemExit(
            "Set LEAN_BULKING_PDF_DIR to a local folder of cookbook PDFs you are allowed to read. "
            "Those PDFs are not part of this repository."
        )
    return path

import os
from PIL import Image, ImageDraw, ImageFont

img_dir = os.path.join(_repo_root(), "public", "images")
os.makedirs(img_dir, exist_ok=True)

# Generate a high-res 1024x1024 base icon
size = 1024
img = Image.new("RGBA", (size, size), (9, 13, 22, 255)) # Dark background #090d16
draw = ImageDraw.Draw(img)

# Draw rounded emerald-lime badge
padding = 100
badge_rect = [padding, padding, size - padding, size - padding]
# Draw a smooth rounded rectangle
draw.rounded_rectangle(badge_rect, radius=180, fill=(16, 185, 129, 255)) # Emerald #10b981

# Inner accent circle/glow
inner_padding = 160
inner_rect = [inner_padding, inner_padding, size - inner_padding, size - inner_padding]
draw.ellipse(inner_rect, fill=(5, 150, 105, 255)) # Emerald 600

# Try drawing a stylized flame or text "CC" (Clean Cooking)
# Let's draw high-contrast "CC" or chef hat / flame shape
try:
    # Use default or basic font if available, or draw geometric shapes
    font = ImageFont.truetype("arial.ttf", 400)
    # text bbox
    bbox = draw.textbbox((0, 0), "CC", font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    draw.text(((size - w) / 2, (size - h) / 2 - 30), "CC", font=font, fill=(255, 255, 255, 255))
except Exception:
    draw.text((size//2 - 150, size//2 - 100), "CC", fill=(255, 255, 255, 255))

# Export 512x512
img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
img_512.save(os.path.join(img_dir, "icon-512.png"))

# Export 192x192
img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
img_192.save(os.path.join(img_dir, "icon-192.png"))

# Export Maskable icon (512x512 with safe area margin)
maskable = Image.new("RGBA", (512, 512), (9, 13, 22, 255))
mask_badge = img.resize((410, 410), Image.Resampling.LANCZOS)
maskable.paste(mask_badge, (51, 51), mask_badge)
maskable.save(os.path.join(img_dir, "icon-maskable.png"))

print("Icons generated successfully!")
