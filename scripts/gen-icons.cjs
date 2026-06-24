/**
 * Generates the app logo / PWA icons / favicon as real files — no external image
 * library and no fonts (so it can't hit the @vercel/og file-URL bug on this
 * OneDrive path).
 *
 * Logo: a white HOUSE (pitched roof + body) on the coral (#dd6647) brand tile,
 * with a white HEART cut into the house (the coral background shows through). The
 * heart is rasterized from its implicit curve
 *   (u^2 + v^2 - 1)^3 - u^2 * v^3 <= 0
 * and the house from simple polygon tests. 3x3 supersampling anti-aliases edges.
 *
 * Outputs: public/icon-192.png, public/icon-512.png, src/app/apple-icon.png,
 * and public/favicon.ico (kept in /public — NOT app/ — so per-agency white-label
 * favicons set via the Metadata API can override it; see the dashboard/agency
 * generateMetadata).
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

// --- heart implicit curve + auto bounding box ---
function inHeart(u, v) {
  const a = u * u + v * v - 1;
  return a * a * a - u * u * v * v * v <= 0;
}
function heartBox() {
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  const STEPS = 1400;
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

// --- geometry (normalized [0,1], y down), inside the maskable safe zone ---
const BODY = { x0: 0.297, x1: 0.703, y0: 0.49, y1: 0.8125 };
const ROOF = { apexY: 0.182, baseY: 0.5, halfBase: 0.3125 }; // apex centred at x=0.5

function inHouse(nx, ny) {
  if (nx >= BODY.x0 && nx <= BODY.x1 && ny >= BODY.y0 && ny <= BODY.y1) return true;
  if (ny >= ROOF.apexY && ny <= ROOF.baseY) {
    const halfW = ROOF.halfBase * ((ny - ROOF.apexY) / (ROOF.baseY - ROOF.apexY));
    if (Math.abs(nx - 0.5) <= halfW) return true;
  }
  return false;
}

// Heart cut into the body (coral background shows through).
const HCU = (BOX.minU + BOX.maxU) / 2;
const HCV = (BOX.minV + BOX.maxV) / 2;
const HEART_W = BOX.maxU - BOX.minU;
const HEART = { Wn: 0.24, Hx: 0.5, Hy: 0.656 };
const HEART_SCALE = HEART.Wn / HEART_W;
function inHeartCutout(nx, ny) {
  const u = HCU + (nx - HEART.Hx) / HEART_SCALE;
  const v = HCV - (ny - HEART.Hy) / HEART_SCALE; // v up
  return inHeart(u, v);
}

function renderRGB(N) {
  const ss = 3; // 3x3 supersampling
  const rgb = Buffer.alloc(N * N * 3);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      let hits = 0; // count WHITE subsamples (house minus the heart cut-out)
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const nx = (px + (sx + 0.5) / ss) / N;
          const ny = (py + (sy + 0.5) / ss) / N;
          if (inHouse(nx, ny) && !inHeartCutout(nx, ny)) hits++;
        }
      }
      const t = hits / (ss * ss); // 0 = coral, 1 = white
      const o = (py * N + px) * 3;
      for (let c = 0; c < 3; c++) rgb[o + c] = Math.round(CORAL[c] + (WHITE[c] - CORAL[c]) * t);
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

// Wrap a PNG in a single-image .ico (PNG-in-ICO, supported by all modern browsers).
function encodeIco(pngBuf, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, pngBuf]);
}

const root = path.resolve(__dirname, '..');
const pngTargets = [
  { size: 192, file: path.join(root, 'public', 'icon-192.png') },
  { size: 512, file: path.join(root, 'public', 'icon-512.png') },
  { size: 180, file: path.join(root, 'src', 'app', 'apple-icon.png') },
];
for (const { size, file } of pngTargets) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePng(size, renderRGB(size)));
  console.log(`wrote ${path.relative(root, file)} (${size}x${size})`);
}

const icoFile = path.join(root, 'public', 'favicon.ico');
fs.writeFileSync(icoFile, encodeIco(encodePng(48, renderRGB(48)), 48));
console.log(`wrote ${path.relative(root, icoFile)} (48x48 ico)`);

console.log('done');
