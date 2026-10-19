# The spray-paint cover: real Chog Genesis art slapped on a concrete wall as stickers, sprayed colour
# splashes with drips and overspray, and the logo on top. Writes launch/cover.png (1920x1080) and
# launch/cover-square.png (1200x1200). Inputs: assets-src/cover/<id>.webp (real art from /img/<id>),
# assets-src/cover/Fredoka.ttf, public/fx/wash-*.webp, assets-src/logo.png. Run: python scripts/build-cover.py
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

R = random.Random(11)
SRC = 'assets-src/cover'
os.makedirs('launch', exist_ok=True)
INK = (20, 16, 20)
PAINT = [(255, 46, 136), (255, 214, 60), (45, 226, 230), (131, 110, 249), (182, 255, 59), (255, 159, 28)]

def wall(W, H):
  rng = np.random.default_rng(3)
  base = np.zeros((H, W, 3)) + np.array([30, 24, 38])
  for s, a in [(4, 18), (16, 14), (64, 10)]:  # concrete: noise at a few scales
    n = rng.random((H // s + 2, W // s + 2))
    n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), float) / 255 - .5
    base += n[..., None] * a
  y, x = np.mgrid[0:H, 0:W]
  glow = np.exp(-(((x - W / 2) / (W * .45)) ** 2 + ((y - H * .38) / (H * .5)) ** 2))
  base += glow[..., None] * np.array([40, 14, 52])
  im = Image.fromarray(base.clip(0, 255).astype(np.uint8)).convert('RGBA')
  d = ImageDraw.Draw(im)
  for yy in range(0, H, 54):  # faint bricks
    d.line([(0, yy), (W, yy)], fill=(0, 0, 0, 70), width=3)
    off = 0 if (yy // 54) % 2 else 60
    for xx in range(off, W, 120): d.line([(xx, yy), (xx, yy + 54)], fill=(0, 0, 0, 60), width=3)
  return im

def overspray(layer, cx, cy, rad, col, n=2200):
  d = ImageDraw.Draw(layer)
  for _ in range(n):
    r = abs(R.gauss(0, rad)); a = R.random() * math.tau
    x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
    s = R.random() * 2.2 + .4
    d.ellipse([x - s, y - s, x + s, y + s], fill=col + (R.randint(90, 220),))

def drips(layer, cx, cy, w, col, n=6):
  d = ImageDraw.Draw(layer)
  for _ in range(n):
    x = cx + R.uniform(-w / 2, w / 2); y = cy + R.uniform(-20, 30); L = R.uniform(40, 220); t = R.uniform(5, 13)
    d.rectangle([x - t / 2, y, x + t / 2, y + L], fill=col + (235,))
    d.ellipse([x - t * .8, y + L - t * .6, x + t * .8, y + L + t], fill=col + (235,))

def splash(canvas, name, cx, cy, size, rot, alpha=.9):
  im = Image.open(f'public/fx/wash-{name}.webp').convert('RGBA').resize((size, size), Image.LANCZOS).rotate(rot, expand=True, resample=Image.BICUBIC)
  a = im.split()[3].point(lambda v: int(v * alpha)); im.putalpha(a)
  canvas.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))

def sticker(canvas, path, cx, cy, size, rot):
  art = Image.open(path).convert('RGBA').resize((size, size), Image.LANCZOS)
  m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 9, fill=255)
  art.putalpha(m)
  b = size // 14  # white sticker cut, then an ink line
  S = size + b * 2
  card = Image.new('RGBA', (S + 8, S + 8), (0, 0, 0, 0))
  ImageDraw.Draw(card).rounded_rectangle([4, 4, S + 3, S + 3], radius=size // 7, fill=(255, 250, 240, 255), outline=INK + (255,), width=max(3, size // 60))
  card.alpha_composite(art, (b + 4, b + 4))
  ImageDraw.Draw(card).rounded_rectangle([b + 4, b + 4, b + 3 + size, b + 3 + size], radius=size // 9, outline=INK + (255,), width=max(3, size // 70))
  card = card.rotate(rot, expand=True, resample=Image.BICUBIC)
  sh = Image.new('RGBA', card.size, (0, 0, 0, 0)); sh.putalpha(card.split()[3].point(lambda v: int(v * .55)))
  sh = sh.filter(ImageFilter.GaussianBlur(10))
  canvas.alpha_composite(sh, (int(cx - card.width / 2 + 14), int(cy - card.height / 2 + 18)))
  canvas.alpha_composite(card, (int(cx - card.width / 2), int(cy - card.height / 2)))

def logo(canvas, cx, cy, width):
  lg = Image.open('assets-src/logo.png').convert('RGBA'); lg = lg.crop(lg.getbbox())
  lg = lg.resize((width, int(lg.height * width / lg.width)), Image.LANCZOS)
  a = lg.split()[3].point(lambda v: 255 if v > 90 else 0)  # the PNG has faint alpha across its whole box: keep only the letters
  halo = a.filter(ImageFilter.GaussianBlur(14)).point(lambda v: min(255, v * 5)).filter(ImageFilter.GaussianBlur(5))  # a soft sprayed halo behind the letters
  pad = 40
  out = Image.new('RGBA', (lg.width + pad * 2, lg.height + pad * 2), (0, 0, 0, 0))
  white = Image.new('RGBA', lg.size, (255, 250, 240, 255)); white.putalpha(halo.point(lambda v: min(255, int(v * 1.1))))
  edge = Image.new('RGBA', lg.size, INK + (255,)); edge.putalpha(a.filter(ImageFilter.MaxFilter(7)))
  out.alpha_composite(white, (pad, pad)); out.alpha_composite(edge, (pad, pad)); out.alpha_composite(lg, (pad, pad))
  sh = Image.new('RGBA', out.size, (0, 0, 0, 0)); sh.putalpha(out.split()[3].point(lambda v: int(v * .6))); sh = sh.filter(ImageFilter.GaussianBlur(14))
  canvas.alpha_composite(sh, (int(cx - out.width / 2 + 10), int(cy - out.height / 2 + 16)))
  canvas.alpha_composite(out, (int(cx - out.width / 2), int(cy - out.height / 2)))

def tag(canvas, text, cx, cy, size, col):
  f = ImageFont.truetype(f'{SRC}/Fredoka.ttf', size); f.set_variation_by_name('Bold')
  L = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); d = ImageDraw.Draw(L)
  w = d.textlength(text, font=f)
  x, y = cx - w / 2, cy - size / 2
  for k in range(1, 7): d.text((x + k, y + k), text, font=f, fill=INK + (255,))  # chunky 3D shadow
  d.text((x, y), text, font=f, fill=col + (255,), stroke_width=4, stroke_fill=INK + (255,))
  canvas.alpha_composite(L)

def build(W, H, out, chogs, logo_w, logo_y, tag_y):
  c = wall(W, H)
  paint = Image.new('RGBA', (W, H), (0, 0, 0, 0))
  for name, x, y, s, r in [('pink', .18, .3, .62, 20), ('yellow', .82, .28, .58, -30), ('cyan', .5, .82, .7, 5), ('mon', .9, .85, .5, 60), ('lime', .08, .85, .45, -50), ('red', .5, .22, .5, 90)]:
    splash(paint, name, W * x, H * y, int(min(W, H) * s), r, .78)
  for col, x, y in zip(PAINT, [.15, .85, .5, .3, .7, .05], [.45, .5, .95, .1, .08, .6]):
    overspray(paint, W * x, H * y, min(W, H) * .07, col, 1600)
    drips(paint, W * x, H * y + 30, 140, col, 5)
  c.alpha_composite(paint)
  for (cid, x, y, s, r) in chogs: sticker(c, f'{SRC}/{cid}.webp', W * x, H * y, int(min(W, H) * s), r)
  logo(c, W / 2, H * logo_y, logo_w)
  tag(c, 'You win or you get rugged.', W / 2, H * tag_y, int(min(W, H) * .062), (255, 225, 77))
  fx = Image.new('RGBA', (W, H), (0, 0, 0, 0))  # a last mist of overspray over everything
  for col in PAINT[:4]: overspray(fx, R.uniform(0, W), R.uniform(0, H), min(W, H) * .2, col, 500)
  c.alpha_composite(fx)
  c.convert('RGB').save(out, optimize=True)
  print(out, c.size, os.path.getsize(out) // 1024, 'KB')

build(1920, 1080, 'launch/cover.png', [
  ('7', .09, .27, .24, -12), ('1603', .9, .25, .24, 10), ('53', .1, .74, .25, 8), ('973', .9, .74, .25, -9),
  ('1225', .27, .8, .2, -5), ('1745', .73, .8, .2, 7), ('140', .5, .79, .27, -3)], 1150, .36, .955)
build(1200, 1200, 'launch/cover-square.png', [
  ('7', .13, .16, .24, -12), ('1603', .87, .16, .24, 10), ('53', .15, .72, .25, 8), ('973', .85, .72, .25, -9), ('140', .5, .74, .3, -3)], 1000, .4, .95)
