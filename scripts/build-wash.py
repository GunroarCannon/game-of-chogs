# Procedural watercolor textures: a tileable paper grain and a few colour splashes (blooms, pooled edges,
# granulation) used behind portraits, slam words and cards. Run: python scripts/build-wash.py
import numpy as np
from PIL import Image, ImageFilter
rng = np.random.default_rng(7)

def noise(n, octaves=5, tile=True):
  out = np.zeros((n, n))
  for o in range(octaves):
    s = 2 ** (o + 2)
    g = rng.random((s, s))
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
    out += np.asarray(im, float) / 255 / (2 ** o)
  out -= out.min(); return out / out.max()

# paper: warm cream, soft fibres, tileable by wrapping a blurred noise
n = 256
p = noise(n, 6)
fib = Image.fromarray((rng.random((n, n)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))
p = .62 * p + .38 * np.asarray(fib, float) / 255
base = np.array([255, 248, 236], float)
paper = base[None, None, :] * (0.94 + 0.06 * p[..., None])
Image.fromarray(paper.clip(0, 255).astype(np.uint8)).save('public/fx/paper.webp', 'WEBP', quality=80)

def splash(rgb, size=420, seed=0):
  r = np.random.default_rng(seed)
  y, x = np.mgrid[0:size, 0:size] / size - .5
  ang = np.arctan2(y, x); dist = np.hypot(x, y)
  rad = .31 + sum(r.uniform(.006, .028) * np.sin(k * ang + r.uniform(0, 6.3)) for k in range(2, 9))
  nz = noise(size, 5)
  edge = rad + (nz - .5) * .12 - dist
  a = np.clip(edge * 22, 0, 1)
  pool = np.exp(-((edge - .012) ** 2) / .0004) * (edge > 0)  # dark pooled rim
  bloom = noise(size, 4)
  alpha = a * (.55 + .35 * bloom) + pool * .35
  # satellite drops
  for _ in range(r.integers(6, 12)):
    cx, cy, cr = r.uniform(-.45, .45), r.uniform(-.45, .45), r.uniform(.008, .03)
    if np.hypot(cx, cy) < .3: continue
    d = np.hypot(x - cx, y - cy); alpha = np.maximum(alpha, np.clip((cr - d) * 200, 0, 1) * .8)
  gran = rng.random((size, size)) * .18
  col = np.array(rgb, float)[None, None, :] * (1 - .35 * pool[..., None] - gran[..., None] * .5)
  img = np.dstack([col.clip(0, 255), (alpha.clip(0, 1) * 235)]).astype(np.uint8)
  Image.fromarray(img, 'RGBA').save(f'public/fx/wash-{name}.webp', 'WEBP', quality=82)

for i, (name, rgb) in enumerate({'pink': (255, 46, 136), 'mon': (131, 110, 249), 'yellow': (255, 214, 60), 'cyan': (45, 226, 230), 'red': (226, 30, 50), 'lime': (160, 240, 60)}.items()):
  splash(rgb, seed=i + 3)
print('ok')
