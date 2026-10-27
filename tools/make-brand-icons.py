"""Build the aSi mark and app icons from the AfterSIght poster (Pillow + numpy).

The circuit S and I are cut from the poster; the top bar above the I is split off so it reads as the dot of a
lowercase i, and a lowercase a in Montserrat goes in front. Output goes to assets/brand/.

    python3 tools/make-brand-icons.py /path/to/aftersight-poster-sunny.jpg
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

POSTER = sys.argv[1] if len(sys.argv) > 1 else '/workspace/aftersight-brand/aftersight-poster-sunny.jpg'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'brand')
FONT = '/usr/share/fonts/truetype/sand-box/google/Montserrat/Montserrat-VariableFont_wght.ttf'

src = np.asarray(Image.open(POSTER).convert('RGB')).astype(np.float32)
X0, X1, Y0, Y1 = 543, 750, 700, 1010          # the circuit S + I, with some of the traces above and below
BASE, CAP, XH = 983, 794, 850                  # baseline, cap height and x-height (top of the I stem) in poster rows
SPLIT = (684, 697)                             # columns where the S's top bar meets the bar above the I

# sky behind the glyphs: per-row median of the clear columns just left of the S, smoothed
sky_col = np.median(src[:, 543:550], axis=1)
sky_col = np.asarray(Image.fromarray(sky_col.astype(np.uint8)[:, None, :]).filter(ImageFilter.MedianFilter(41))).astype(np.float32)[:, 0]

glyph = src[Y0:Y1, X0:X1].copy()
# split the top bar so the right end becomes the dot of the i
for y in range(CAP - 6, XH - 2):
    glyph[y - Y0, SPLIT[0] - X0:SPLIT[1] - X0] = sky_col[y]

H = Y1 - Y0
probe = ImageDraw.Draw(Image.new('RGB', (10, 10)))
size = 10
while True:
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_axes([700])
    l, t, r, b = probe.textbbox((0, 0), 'a', font=f)
    if b - t >= (BASE - XH) + 4: break
    size += 2
A_W, GAP = (r - l) + 6, 10
W = A_W + GAP + (X1 - X0)
strip = np.repeat(sky_col[Y0:Y1][:, None, :], W, axis=1)
# keep only what differs from the sky (the letters and the dark traces), so no rectangle shows behind them
diff = np.abs(glyph - sky_col[Y0:Y1][:, None, :]).sum(axis=2)
mask = Image.fromarray(((diff > 70) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1))
alpha = np.asarray(mask).astype(np.float32)[:, :, None] / 255
strip[:, A_W + GAP:] = glyph * alpha + strip[:, A_W + GAP:] * (1 - alpha)
img = Image.fromarray(strip.clip(0, 255).astype(np.uint8))

# the lowercase a: its x-height matches the i stem, sitting on the same baseline
draw = ImageDraw.Draw(img)
draw.text((6 - l, BASE - Y0 - b), 'a', font=f, fill=(32, 41, 54))
img.save('/tmp/asi-strip.png')

def square(px, radius=0.22):
    # fit the strip to the width, centred on the letters, sky above and below
    s = int(px * 4)
    scale = s * 0.86 / W
    st = img.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
    mid = ((CAP + BASE) / 2 - Y0) * scale
    top = int(s / 2 - mid)
    rows = np.arange(s) - top                       # strip row under each output row, edge colours outside it
    src_rows = np.clip((rows / scale).astype(int), 0, H - 1) + Y0
    bg = Image.fromarray(np.repeat(sky_col[src_rows][:, None, :], s, axis=1).clip(0, 255).astype(np.uint8))
    bg.paste(st, ((s - st.width) // 2, top))
    out = bg.resize((px, px), Image.LANCZOS).convert('RGBA')
    if radius:
        m = Image.new('L', (s, s), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * radius), fill=255)
        out.putalpha(m.resize((px, px), Image.LANCZOS))
    return out

q = lambda im: im.quantize(256, method=Image.FASTOCTREE)
q(square(180, 0)).save(os.path.join(OUT, 'apple-touch-icon.png'), optimize=True)
q(square(192)).save(os.path.join(OUT, 'si-192.png'), optimize=True)
q(square(512)).save(os.path.join(OUT, 'si-512.png'), optimize=True)
square(32).save(os.path.join(OUT, 'si-32.png'), optimize=True)
square(64).save(os.path.join(OUT, 'si-mark.webp'), 'WEBP', quality=88)
square(64).save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
square(256).save('/tmp/asi-256.png')
print('ok', W, H, size)
