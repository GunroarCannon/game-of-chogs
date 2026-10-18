# Packs assets-src/effects/* frame folders into one horizontal sprite strip per effect (public/fx/*.webp)
# plus public/fx/fx.json with frame sizes. Blood is pre-tinted red; stains stay white (tinted at runtime).
# Also writes the logo as webp. Run: python scripts/build-fx.py
import json, os, re
from PIL import Image

SRC, OUT = 'assets-src/effects', 'public/fx'
os.makedirs(OUT, exist_ok=True)
num = lambda s: int(re.sub(r'\D', '', s) or 0)
SHEETS = {  # name: (folder, tint, scale)
  'boom': ('explosion', None, 1.5), 'hit': ('hit1', None, 1.2), 'hit2': ('hit2', None, 1.2), 'pow': ('pow', None, 1.2),
  'chomp': ('center_bite', None, .6), 'bubble': ('water_bubble', None, .6),
  'blood': ('blood/blood_1/anim', (200, 16, 40), .7), 'blood2': ('blood/blood_2/anim', (200, 16, 40), .7),
  'squirt': ('bloodm/blood_2', (200, 16, 40), .8), 'drops': ('bloodm/blood_1', (200, 16, 40), .8),
  'stain': ('stain', None, .5), 'splat': ('bloodm/blood_stains_1', (170, 10, 30), .8),
}
def tint(im, rgb):
  r, g, b, a = im.split()
  lum = Image.merge('RGB', (r, g, b)).convert('L')
  col = Image.new('RGB', im.size, rgb)
  dark = Image.new('RGB', im.size, tuple(c // 3 for c in rgb))
  rgbim = Image.composite(col, dark, lum.point(lambda v: 255 if v > 90 else 0))  # white -> red, black outline -> dark red
  rgbim.putalpha(a); return rgbim
meta = {}
for name, (folder, t, sc) in SHEETS.items():
  d = os.path.join(SRC, folder)
  fs = sorted([f for f in os.listdir(d) if f.endswith('.png')], key=num)
  ims = [Image.open(os.path.join(d, f)).convert('RGBA') for f in fs]
  w = max(i.width for i in ims); h = max(i.height for i in ims)
  W, H = round(w * sc), round(h * sc)
  strip = Image.new('RGBA', (W * len(ims), H))
  for k, im in enumerate(ims):
    if t: im = tint(im, t)
    fr = Image.new('RGBA', (w, h)); fr.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
    strip.alpha_composite(fr.resize((W, H), Image.LANCZOS), (k * W, 0))
  strip.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88, method=6)
  meta[name] = {'w': W, 'h': H, 'n': len(ims)}
for f, sc in [('fire.png', .6), ('scorch_1.png', .8), ('scorch_2.png', .8)]:
  im = Image.open(os.path.join(SRC, f)).convert('RGBA')
  im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
  n = f[:-4].replace('_', ''); im.save(os.path.join(OUT, n + '.webp'), 'WEBP', quality=88, method=6)
  meta[n] = {'w': im.width, 'h': im.height, 'n': 1}
json.dump(meta, open(os.path.join(OUT, 'fx.json'), 'w'), separators=(',', ':'))
logo = Image.open('assets-src/logo.png').convert('RGBA'); logo = logo.crop(logo.getbbox())
logo.save('public/logo.webp', 'WEBP', quality=90, method=6)
logo.resize((logo.width * 90 // logo.height, 90), Image.LANCZOS).save('public/logo-sm.webp', 'WEBP', quality=90, method=6)
print(json.dumps(meta)); print('logo', logo.size)
