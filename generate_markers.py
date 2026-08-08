import os
from PIL import Image, ImageDraw, ImageFilter

def create_glowing_pin_marker(filename, bg_color, symbol_type, glow_color):
    width, height = 64, 84
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    # 1. Glow Layer
    glow_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    # Circle glow at center
    glow_draw.ellipse([8, 8, 56, 56], fill=glow_color)
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(radius=6))
    
    # Composite glow onto main img
    img.alpha_composite(glow_img)
    
    draw = ImageDraw.Draw(img)
    
    # 2. Pin Base Drop Shadow
    draw.ellipse([14, 68, 50, 80], fill=(0, 0, 0, 90))
    
    # 3. Outer Pin Teardrop Shape
    # Top Circle
    draw.ellipse([8, 8, 56, 56], fill=bg_color, outline=(255, 255, 255, 255), width=4)
    # Pointer Triangle at bottom
    point = [(22, 48), (42, 48), (32, 74)]
    draw.polygon(point, fill=bg_color)
    draw.line([(22, 48), (32, 74), (42, 48)], fill=(255, 255, 255, 255), width=3)
    
    # 4. Inner White Circle Badge
    draw.ellipse([16, 16, 48, 48], fill=(255, 255, 255, 255))
    
    # 5. Icon Symbol inside inner circle
    draw_symbol(draw, symbol_type, bg_color)
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    img.save(filename, 'PNG')
    print(f"Created glowing marker: {filename}")

def draw_symbol(draw, symbol_type, color):
    if symbol_type == 'shop':
        # Store front
        draw.polygon([(22, 26), (32, 20), (42, 26)], fill=color)
        draw.rectangle([24, 26, 40, 40], fill=color)
        draw.rectangle([29, 32, 35, 40], fill=(255, 255, 255))
    elif symbol_type == 'user':
        # Person
        draw.ellipse([27, 21, 37, 31], fill=color)
        draw.pieslice([22, 30, 42, 44], 180, 360, fill=color)
    elif symbol_type == 'order':
        # Shopping Bag
        draw.rectangle([23, 26, 41, 41], fill=color)
        draw.arc([27, 21, 37, 29], 180, 360, fill=color, width=3)
    else: # other
        draw.ellipse([26, 26, 38, 38], fill=color)

if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), 'static', 'markers')
    # Emerald green glow
    create_glowing_pin_marker(os.path.join(out_dir, 'shop.png'), (16, 185, 129, 255), 'shop', (16, 185, 129, 180))
    # Electric Blue glow
    create_glowing_pin_marker(os.path.join(out_dir, 'user.png'), (59, 130, 246, 255), 'user', (59, 130, 246, 180))
    # Vivid Amber glow
    create_glowing_pin_marker(os.path.join(out_dir, 'order.png'), (245, 158, 11, 255), 'order', (245, 158, 11, 180))
    # Purple glow
    create_glowing_pin_marker(os.path.join(out_dir, 'other.png'), (139, 92, 246, 255), 'other', (139, 92, 246, 180))
