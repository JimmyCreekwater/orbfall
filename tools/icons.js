// Draws the mark (the brass orb on felt, shaded exactly like drawBall in index.html) and writes the PWA icons and
// the link-preview image. No dependencies. Run `npm run icons` only if the mark changes: the PNGs are checked in,
// this is not a build step.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const OUT = path.join(__dirname, '..', 'icons');

/* palette, as in index.html */
const FELT = [0x10, 0x23, 0x1e], WHITE = [255, 255, 255], BLACK = [0, 0, 0];
const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, t, to) => [a[0] + (to[0] - a[0]) * t, a[1] + (to[1] - a[1]) * t, a[2] + (to[2] - a[2]) * t];
const BRASS = hex('#b8955a'), HI = mix(BRASS, .55, WHITE), LO = mix(BRASS, .38, BLACK);

/* canvas-style radial gradient: the parameter of the largest circle (centre c0->c1, radius r0->r1) through p */
function radialT(px, py, x0, y0, r0, x1, y1, r1) {
  const dx = x1 - x0, dy = y1 - y0, dr = r1 - r0, qx = px - x0, qy = py - y0;
  const a = dx * dx + dy * dy - dr * dr, b = -2 * (qx * dx + qy * dy + r0 * dr), c = qx * qx + qy * qy - r0 * r0;
  if (Math.abs(a) < 1e-9) return b ? -c / b : 0;
  const disc = b * b - 4 * a * c; if (disc < 0) return 1;
  const s = Math.sqrt(disc), t1 = (-b + s) / (2 * a), t2 = (-b - s) / (2 * a), hi = Math.max(t1, t2), lo = Math.min(t1, t2);
  return r0 + hi * dr >= 0 ? hi : lo;
}
const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
function inRoundRect(x, y, W, H, R) {
  if (x < 0 || y < 0 || x > W || y > H) return false;
  const cx = x < R ? R : x > W - R ? W - R : x, cy = y < R ? R : y > H - R ? H - R : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
}

/* colour of one sample point as [r, g, b, alpha 0..1]; the orb sits at spec.at (fractions of W, H), sized by min(W, H) */
function shade(x, y, W, H, spec) {
  const S = Math.min(W, H);
  if (spec.corner && !inRoundRect(x, y, W, H, S * spec.corner)) return [0, 0, 0, 0];
  // felt with the game's vignette: white at .035 in the centre fading to black at .4 towards the edge
  const tv = clamp01(radialT(x, y, W / 2, H * .42, S * .12, W / 2, H * .5, S * .85));
  let col = mix(FELT, .035 + (.4 - .035) * tv, mix(WHITE, tv, BLACK));
  const at = spec.at || [.5, .5], cx = W * at[0], cy = H * at[1], r = S * spec.orb, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), w = Math.max(1.5, r * .06);
  if (d <= r) { // the orb: highlight up-left, base colour, dark at the far edge
    const t = clamp01(radialT(x, y, cx - r * .35, cy - r * .4, r * .05, cx, cy, r * 1.05));
    col = t < .55 ? mix(HI, t / .55, BRASS) : mix(BRASS, (t - .55) / .45, LO);
  }
  if (d >= r - w / 2 && d <= r + w / 2) col = mix(col, .22, BLACK); // rim
  if (d <= r) {
    for (const [ox, oy, rr] of [[.42, .22, .15], [-.18, .5, .1], [.05, -.52, .08]]) // the three soft craters
      if (Math.hypot(dx - ox * r, dy - oy * r) <= rr * r) col = mix(col, .13, BLACK);
    const ex = dx + .36 * r, ey = dy + .46 * r, cs = Math.cos(-.6), sn = Math.sin(-.6); // specular highlight
    const u = ex * cs + ey * sn, v = -ex * sn + ey * cs;
    if ((u / (.2 * r)) ** 2 + (v / (.11 * r)) ** 2 <= 1) col = mix(col, .38, WHITE);
  }
  return [col[0], col[1], col[2], 1];
}

/* supersampled raster to straight-alpha RGBA */
function raster(W, H, spec, ss) {
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const c = shade(x + (i + .5) / ss, y + (j + .5) / ss, W, H, spec);
      r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
    }
    const o = (y * W + x) * 4;
    if (a > 0) { buf[o] = Math.round(r / a); buf[o + 1] = Math.round(g / a); buf[o + 2] = Math.round(b / a); }
    buf[o + 3] = Math.round(a / (ss * ss) * 255);
  }
  return buf;
}

/* minimal PNG writer: 8-bit RGBA, no filtering */
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(W, H, rgba) {
  const stride = W * 4 + 1, raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) { raw[y * stride] = 0; rgba.copy(raw, y * stride + 1, y * W * 4, (y + 1) * W * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const IMAGES = [
  ['icon-192.png', 192, 192, { corner: .22, orb: .33 }],        // purpose any: rounded felt tile
  ['icon-512.png', 512, 512, { corner: .22, orb: .33 }],
  ['maskable-192.png', 192, 192, { orb: .32 }],                 // purpose maskable: full bleed, orb inside the 80% safe zone
  ['maskable-512.png', 512, 512, { orb: .32 }],
  ['apple-touch-icon.png', 180, 180, { orb: .36 }],             // iOS masks its own corners
  ['share.png', 1200, 630, { orb: .36, at: [.5, .5] }]          // link preview (og:image), the mark on felt
];
fs.mkdirSync(OUT, { recursive: true });
for (const [name, w, h, spec] of IMAGES) {
  fs.writeFileSync(path.join(OUT, name), png(w, h, raster(w, h, spec, w > 600 ? 2 : 4)));
  console.log('icons/' + name + '  ' + w + 'x' + h);
}
