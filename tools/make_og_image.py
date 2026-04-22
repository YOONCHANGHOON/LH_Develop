"""OG 이미지 생성 (1200x630, JPG). Usage: python tools/make_og_image.py"""
from PIL import Image, ImageDraw, ImageFont
import os
import random

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'og-image.jpg')

# ---- Background: vertical gradient (dark green)
img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)
top = (31, 74, 58)     # #1f4a3a
bot = (10, 33, 24)     # #0a2118
for y in range(H):
    t = y / H
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# ---- Accent corner triangle (top-right, subtle)
tri = Image.new('RGBA', (W, H), (0, 0, 0, 0))
tri_draw = ImageDraw.Draw(tri)
tri_draw.polygon([(W, 0), (W, 300), (W - 420, 0)], fill=(47, 107, 86, 180))
img.paste(tri, (0, 0), tri)

# ---- Subtle dot constellation in triangle area
random.seed(42)
for _ in range(60):
    x = random.randint(W - 380, W - 20)
    y = random.randint(20, 260)
    r = random.choice([2, 2, 3, 4])
    opacity = random.randint(60, 160)
    dot = Image.new('RGBA', (r * 2 + 2, r * 2 + 2), (0, 0, 0, 0))
    dot_draw = ImageDraw.Draw(dot)
    dot_draw.ellipse([(1, 1), (r * 2, r * 2)], fill=(255, 255, 255, opacity))
    img.paste(dot, (x, y), dot)

# ---- Gold accent bar (bottom)
draw.rectangle([(0, H - 6), (W, H)], fill='#b89860')

# ---- Left accent vertical bar
draw.rectangle([(72, 96), (78, 248)], fill='#b89860')

# ---- Fonts
FONT_REG = 'C:/Windows/Fonts/NotoSansKR-Regular.ttf'
FONT_BOLD = 'C:/Windows/Fonts/NotoSansKR-Bold.ttf'

font_eyebrow = ImageFont.truetype(FONT_BOLD, 24)
font_title_main = ImageFont.truetype(FONT_BOLD, 96)
font_title_sub = ImageFont.truetype(FONT_BOLD, 72)
font_lede = ImageFont.truetype(FONT_REG, 28)
font_cta = ImageFont.truetype(FONT_BOLD, 26)
font_foot = ImageFont.truetype(FONT_REG, 20)

# ---- Eyebrow
draw.text((100, 110), '역세권 도심 공공주택 복합사업', fill='#8ee0b9', font=font_eyebrow)

# ---- Main title
draw.text((96, 160), '화곡1동', fill='#ffffff', font=font_title_main)

# ---- Subtitle (smaller, indented a bit)
draw.text((96, 286), '도심 공공주택 복합사업', fill='#ffffff', font=font_title_sub)

# ---- Lede
draw.text((100, 400), '공모 일정 · 접수 장소 · 서류 · 자주 묻는 질문', fill='#c9d4d0', font=font_lede)

# ---- CTA / Deadline pill
cta_text = '공모 기간  2026. 4. 1  —  5. 8'
cta_x, cta_y = 100, 470
# measure text width
bbox = font_cta.getbbox(cta_text)
text_w = bbox[2] - bbox[0]
pad_x, pad_y = 28, 20
cta_w = text_w + pad_x * 2
cta_h = 72
draw.rounded_rectangle([(cta_x, cta_y), (cta_x + cta_w, cta_y + cta_h)],
                       radius=14, fill='#b89860')
draw.text((cta_x + pad_x, cta_y + pad_y - 2), cta_text, fill='#1a1f2c', font=font_cta)

# ---- Footer / site mark
draw.text((100, H - 62), '화곡1동 도심 공공주택 복합사업 추진위원회', fill='#8b9ea2', font=font_foot)

# ---- Save
img.save(OUT, 'JPEG', quality=92, optimize=True, progressive=True)
print(f'Saved: {OUT}')
print(f'Size: {os.path.getsize(OUT)} bytes')
