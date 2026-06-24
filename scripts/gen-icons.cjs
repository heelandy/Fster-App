/**
 * Generates the PWA / app icons as real PNG files — no external image library and
 * no fonts (so it can't hit the @vercel/og file-URL bug on this OneDrive path).
 *
 * The heart is rasterized directly from its implicit curve
 *   (u^2 + v^2 - 1)^3 - u^2 * v^3 <= 0
 * over a coral (#dd6647) full-bleed square (ideal for maskable icons; iOS masks
 * the corners itself). 3x3 supersampling gives smooth, anti-aliased edges.
 *
 * Run:  node scripts/gen-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CORAL = [0xdd, 0x66, 0x47];
const WHITE = [0xff, 0xff, 0xff];

// --- CRC32 (fallback if zlib.crc32 is unavailable) ---
const crc32 =
  typeof zlib.crc32 === 'function'
    ? (buf) => zlib.crc32(buf) >>> 0
    : (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          table[n] = c >>> 0;
        }
        return (buf) => {
          let c = 0xffffffff;
          for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
          return (c ^ 0xffffffff) >>> 0;
        };
      })();

function inHeart(u, v) {
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v <= 0;
}

// Auto-measure the heart's bounding box once so we can center + scale it cleanly.
function heartBox() {
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  const STEPS = 1600;
  for (let i = 0; i <= STEPS; i++) {
    const u = -2 + (4 * i) / STEPS;
    for (let j = 0; j <= STEPS; j++) {
      const v = -2 + (4 * j) / STEPS;
      if (inHeart(u, v)) {
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }
  }
  return { minU, maxU, minV, maxV };
}

const BOX = heartBox();

function renderRGB(N) {
  const cu = (BOX.minU + BOX.maxU) / 2;
  const cv = (BOX.minV + BOX.maxV) / 2;
  const heartSpan = Math.max(BOX.maxU - BOX.minU, BOX.maxV - BOX.minV);
  const frac = 0.56; // heart fills 56% of the tile — inside the maskable safe zone
  const scale = (N * frac) / heartSpan; // pixels per heart-unit
  const cx = N / 2, cy = N / 2;
  const ss = 3; // 3x3 supersampling

  const rgb = Buffer.alloc(N * N * 3);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      let hits = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = px + (sx + 0.5) / ss;
          const fy = py + (sy + 0.5) / ss;
          const u = cu + (fx - cx) / scale;
          const v = cv - (fy - cy) / scale; // v points up
          if (inHeart(u, v)) hits++;
        }
      }
      const t = hits / (ss * ss); // 0 = coral, 1 = white
      const o = (py * N + px) * 3;
      for (let c = 0; c < 3; c++) {
        rgb[o + c] = Math.round(CORAL[c] + (WHITE[c] - CORAL[c]) * t);
      }
    }
  }
  return rgb;
}

function encodePng(N, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB
  const stride = N * 3;
  const raw = Buffer.alloc(N * (stride + 1));
  for (let y = 0; y < N; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const root = path.resolve(__dirname, '..');
const targets = [
  { size: 192, file: path.join(root, 'public', 'icon-192.png') },
  { size: 512, file: path.join(root, 'public', 'icon-512.png') },
  { size: 180, file: path.join(root, 'src', 'app', 'apple-icon.png') },
];

for (const { size, file } of targets) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePng(size, renderRGB(size)));
  console.log(`wrote ${path.relative(root, file)} (${size}x${size})`);
}
console.log('done');
