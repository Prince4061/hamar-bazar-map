"""Generate PWA icons for Hamar Bazar Rider App"""
import os
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    os.system('pip install Pillow')
    from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = os.path.join(os.path.dirname(__file__), 'static', 'icons')
os.makedirs(ICONS_DIR, exist_ok=True)

def create_icon(size, output_path):
    """Create a purple gradient PWA icon with 'HB' text"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle background with purple gradient
    for y in range(size):
        ratio = y / size
        r = int(139 + (109 - 139) * ratio)  # #8B5CF6 -> #6D28D9
        g = int(92 + (40 - 92) * ratio)
        b = int(246 + (217 - 246) * ratio)
        draw.rectangle([0, y, size, y + 1], fill=(r, g, b, 255))
    
    # Round the corners
    corner_radius = size // 5
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_radius, fill=255)
    img.putalpha(mask)
    
    # Draw "HB" text in center
    draw = ImageDraw.Draw(img)
    font_size = size // 3
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()
    
    text = "HB"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2
    y = (size - text_h) // 2 - bbox[1]
    
    # White text shadow for depth
    draw.text((x + 2, y + 2), text, fill=(0, 0, 0, 80), font=font)
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    
    # Draw small motorcycle emoji area (a simple circle with dot below text)
    dot_y = y + text_h + size // 15
    dot_r = size // 20
    dot_x = size // 2
    draw.ellipse([dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r], fill=(255, 255, 255, 180))
    
    img.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")

create_icon(192, os.path.join(ICONS_DIR, 'icon-192x192.png'))
create_icon(512, os.path.join(ICONS_DIR, 'icon-512x512.png'))
print("Done! PWA icons generated successfully.")
