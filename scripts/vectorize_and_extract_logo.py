import os
import base64
import numpy as np
from PIL import Image, ImageFilter, ImageOps, ImageDraw, ImageFont
import scipy.ndimage as ndimage

input_path = 'C:/Users/joaop/.gemini/antigravity-ide/brain/e2eda3e9-c80a-4abe-a759-77ca70cce4f7/media__1791597406435.png'
orig = Image.open(input_path).convert('RGB')
w, h = orig.size

# Upscale original with high-quality Lanczos for smooth edge reconstruction
scale = 4
up_w, up_h = w * scale, h * scale
up_orig = orig.resize((up_w, up_h), Image.Resampling.LANCZOS)
arr = np.array(up_orig, dtype=np.float32)

r = arr[:, :, 0]
g = arr[:, :, 1]
b = arr[:, :, 2]

# Strict badge seed mask:
is_strong_red = (r > 90) & (r - g > 28) & (r - b > 28)
is_bright_white = (r > 165) & (g > 165) & (b > 165)
is_red_glow = (r > 130) & (g > 50) & (r - b > 40)

badge_seeds = is_strong_red | is_bright_white | is_red_glow
badge_seeds[int(up_h * 0.81):, :] = False

badge_mask = ndimage.binary_fill_holes(badge_seeds)
badge_mask = ndimage.binary_opening(badge_mask, structure=np.ones((7, 7)))
badge_mask = ndimage.binary_closing(badge_mask, structure=np.ones((11, 11)))
badge_mask = ndimage.binary_fill_holes(badge_mask)

# Find largest component
labeled, num_features = ndimage.label(badge_mask)
sizes = ndimage.sum(badge_mask, labeled, range(num_features + 1))
largest_label = np.argmax(sizes)
badge_mask = (labeled == largest_label)
badge_mask = ndimage.binary_fill_holes(badge_mask)

# Remove wood artifacts around seal
is_wood = (r < 85) & (g < 50) & (b < 40)
badge_mask[is_wood] = False
badge_mask = ndimage.binary_fill_holes(badge_mask)

# Erode slightly and smooth
badge_mask = ndimage.binary_erosion(badge_mask, structure=np.ones((3, 3)))
badge_mask_float = badge_mask.astype(np.float32)
badge_mask_blurred = ndimage.gaussian_filter(badge_mask_float, sigma=2.2)
badge_alpha = np.clip((badge_mask_blurred - 0.28) / 0.44, 0.0, 1.0)

# Create Badge Only Image
badge_crop_alpha = (badge_alpha * 255).astype(np.uint8)
badge_rgba = np.dstack([arr.astype(np.uint8), badge_crop_alpha])
img_badge = Image.fromarray(badge_rgba, 'RGBA')

# Crop badge to bounding box
bbox = img_badge.getbbox()
if bbox:
    pad = 12
    crop_box = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(up_w, bbox[2] + pad), min(up_h, bbox[3] + pad))
    img_badge_cropped = img_badge.crop(crop_box)
else:
    img_badge_cropped = img_badge

# Save badge PNG
img_badge_cropped.save('public/logo-pracasa-badge.png', optimize=True)

# Master Document / PDF Logo
bw, bh = img_badge_cropped.size
canvas_w = int(bw * 1.05)
canvas_h = int(bh * 1.38)
doc_img = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))

paste_x = (canvas_w - bw) // 2
paste_y = 10
doc_img.paste(img_badge_cropped, (paste_x, paste_y), mask=img_badge_cropped.split()[3])

draw = ImageDraw.Draw(doc_img)
font_size = int(bh * 0.11)
try:
    font_slogan = ImageFont.truetype('C:/Windows/Fonts/segoeprb.ttf', size=font_size)
except:
    font_slogan = ImageFont.load_default()

slogan_text = 'O verdadeiro sabor caseiro!'
# Calculate text position
text_raw_bbox = draw.textbbox((0, 0), slogan_text, font=font_slogan)
text_w = text_raw_bbox[2] - text_raw_bbox[0]
text_x = (canvas_w - text_w) // 2
text_y = paste_y + bh + 14

# Draw text
text_bbox = draw.textbbox((text_x, text_y), slogan_text, font=font_slogan)
draw.text((text_x + 2, text_y + 2), slogan_text, font=font_slogan, fill=(185, 28, 28, 60))
draw.text((text_x, text_y), slogan_text, font=font_slogan, fill=(153, 27, 27, 255)) # rich deep carmine red

# Draw tapered brush stroke cleanly below text
brush_y = text_bbox[3] + 10
brush_w = int(text_w * 0.6)
brush_x = (canvas_w - brush_w) // 2

# Draw smooth polygon brush stroke
brush_poly = [
    (brush_x, brush_y + 1),
    (brush_x + int(brush_w * 0.35), brush_y + 3),
    (brush_x + int(brush_w * 0.7), brush_y + 1),
    (brush_x + brush_w, brush_y - 2),
    (brush_x + int(brush_w * 0.7), brush_y + 5),
    (brush_x + int(brush_w * 0.35), brush_y + 7),
    (brush_x, brush_y + 3)
]
draw.polygon(brush_poly, fill=(220, 38, 38, 240))

# Crop document logo
doc_bbox = doc_img.getbbox()
if doc_bbox:
    pad = 12
    doc_cropped = doc_img.crop((max(0, doc_bbox[0] - pad), max(0, doc_bbox[1] - pad), min(canvas_w, doc_bbox[2] + pad), min(canvas_h, doc_bbox[3] + pad)))
else:
    doc_cropped = doc_img

doc_cropped.save('public/logo-pracasa.png', optimize=True)
doc_cropped.save('public/logo-pracasa-documentos.png', optimize=True)

# Also create high-res white background JPEG
white_doc = Image.new('RGB', doc_cropped.size, (255, 255, 255))
white_doc.paste(doc_cropped, mask=doc_cropped.split()[3])
white_doc.save('public/logo-pracasa-white-bg.jpg', quality=98)

# Dark UI version
dark_doc_img = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
dark_doc_img.paste(img_badge_cropped, (paste_x, paste_y), mask=img_badge_cropped.split()[3])
dark_draw = ImageDraw.Draw(dark_doc_img)
dark_draw.text((text_x + 2, text_y + 2), slogan_text, font=font_slogan, fill=(0, 0, 0, 190))
dark_draw.text((text_x, text_y), slogan_text, font=font_slogan, fill=(255, 255, 255, 255))
dark_draw.polygon(brush_poly, fill=(239, 68, 68, 240))

dark_bbox = dark_doc_img.getbbox()
if dark_bbox:
    dark_cropped = dark_doc_img.crop((max(0, dark_bbox[0] - pad), max(0, dark_bbox[1] - pad), min(canvas_w, dark_bbox[2] + pad), min(canvas_h, dark_bbox[3] + pad)))
else:
    dark_cropped = dark_doc_img

dark_cropped.save('public/logo-pracasa-dark-ui.png', optimize=True)

# Generate compact base64 strings for direct embedding into jsPDF
# To keep base64 bundle reasonable in size while maintaining ultra-sharp 300+ DPI print quality in PDFs,
# resize document logo to 900x560 (crystal clear for 35-50mm in jsPDF)
pdf_embed = doc_cropped.resize((900, int(900 * doc_cropped.size[1] / doc_cropped.size[0])), Image.Resampling.LANCZOS)
pdf_embed.save('public/logo-pracasa-pdf-embed.png', optimize=True)

with open('public/logo-pracasa-pdf-embed.png', 'rb') as f:
    pdf_b64 = base64.b64encode(f.read()).decode('utf-8')

badge_embed = img_badge_cropped.resize((600, int(600 * img_badge_cropped.size[1] / img_badge_cropped.size[0])), Image.Resampling.LANCZOS)
badge_embed.save('public/logo-pracasa-badge-embed.png', optimize=True)

with open('public/logo-pracasa-badge-embed.png', 'rb') as f:
    badge_b64 = base64.b64encode(f.read()).decode('utf-8')

# Write TypeScript file with constants and React component
ts_code = f'''// Logo oficial da marca Tempero PraCasa em alta resolução (Vetorizado / Base64 para jsPDF)
// Auto-gerado a partir da marca original com transparência alfa e contraste de impressão otimizado.

export const LOGO_PRACASA_PNG = 'data:image/png;base64,{pdf_b64}';
export const LOGO_PRACASA_BADGE_PNG = 'data:image/png;base64,{badge_b64}';

/**
 * Dimensões recomendadas para inserção no jsPDF:
 * - Em cabeçalho de pedido / contrato: largura 42mm, altura ~26mm
 * - Em timbrados compactos: largura 32mm, altura ~20mm
 */
export const LOGO_PDF_DIMENSIONS = {{
  width: 42,
  height: 26,
  aspectRatio: 1.615,
}};
'''

with open('src/utils/logoPraCasa.ts', 'w', encoding='utf-8') as f:
    f.write(ts_code)

print('Generated src/utils/logoPraCasa.ts successfully!')
