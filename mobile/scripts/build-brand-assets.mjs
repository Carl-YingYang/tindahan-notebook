/**
 * Tindahan Ko — brand asset builder.
 *
 * Takes the uploaded warm-beige square logo and produces properly separated
 * Expo Android assets:
 *   icon.png         1024×1024  square launcher icon (mark centered, circle-crop safe)
 *   adaptive-icon.png 1024×1024  Android adaptive FOREGROUND (transparent, safe-zone ≤ 66%)
 *   splash-icon.png  1440×2560  transparent centered logo lockup (bg comes from Expo config)
 *   favicon.png       128×128   small web favicon (mark only)
 *
 * Background removal = flood fill from image borders (never punches holes in
 * enclosed cream areas like the awning stripes / notebook paper).
 *
 * Usage: node scripts/build-brand-assets.mjs [/abs/path/to/source.png]
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const SRC =
  process.argv[2] ?? "/home/z/my-project/upload/pasted_image_1789032552686.png";
const OUT = path.resolve(import.meta.dirname, "../assets");
const PREVIEWS = path.join(OUT, "previews");
mkdirSync(PREVIEWS, { recursive: true });

const BG = [252, 235, 203]; // #FCEBCB warm beige sampled from source corners
const BG_HEX = "#FCEBCB";
const NEAR_T = 26; // per-channel tolerance for flood fill

if (!existsSync(SRC)) {
  console.error(`source not found: ${SRC}`);
  process.exit(1);
}

/* ---------- 1. load raw + flood-fill background → transparent ---------- */
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;

const isNearBg = (i) =>
  Math.abs(data[i] - BG[0]) <= NEAR_T &&
  Math.abs(data[i + 1] - BG[1]) <= NEAR_T &&
  Math.abs(data[i + 2] - BG[2]) <= NEAR_T;

// BFS from every border pixel through near-bg pixels; clear alpha on the way.
const visited = new Uint8Array(W * H);
const stack = new Int32Array(W * H);
let sp = 0;
const push = (x, y) => {
  const p = y * W + x;
  if (!visited[p] && isNearBg(p * C)) { visited[p] = 1; stack[sp++] = p; }
};
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (sp > 0) {
  const p = stack[--sp];
  data[p * C + 3] = 0;
  const x = p % W, y = (p / W) | 0;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

/* ---------- 2. measure content bboxes ---------- */
function bbox(x0, y0, x1, y1) {
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (data[(y * W + x) * C + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const MARK = { x0: 0, y0: 268, x1: W - 1, y1: 847 };     // storefront + plant + notebook (rows 268–847)
const LOCKUP = { x0: 0, y0: 268, x1: W - 1, y1: 1055 };  // mark + "Tindahan Ko" + swoosh (rows 268–1055)

const markBox = bbox(MARK.x0, MARK.y0, MARK.x1, MARK.y1);
const lockupBox = bbox(LOCKUP.x0, LOCKUP.y0, LOCKUP.x1, LOCKUP.y1);
console.log("mark bbox  :", JSON.stringify(markBox));
console.log("lockup bbox:", JSON.stringify(lockupBox));

async function cropRegion(box, pad = 3) {
  const left = Math.max(0, box.minX - pad), top = Math.max(0, box.minY - pad);
  const width = Math.min(W, box.maxX + pad) - left, height = Math.min(H, box.maxY + pad) - top;
  return sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}

const markBuf = await cropRegion(markBox);
const lockupBuf = await cropRegion(lockupBox);
const markMeta = await sharp(markBuf).metadata();
const lockupMeta = await sharp(lockupBuf).metadata();

/** max distance of any content pixel from canvas center.
 *  Transparent canvas → counts alpha>8. Opaque canvas (bgHex) → counts pixels differing from bg. */
async function maxContentRadius(buf, bgHex = null) {
  const { data: d, info: m } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cx = m.width / 2, cy = m.height / 2;
  const bgRgb = bgHex ? BG.slice(0, 3) : null;
  let max = 0;
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const i = (y * m.width + x) * 4;
      const isContent = bgRgb
        ? Math.abs(d[i] - bgRgb[0]) > 12 || Math.abs(d[i + 1] - bgRgb[1]) > 12 || Math.abs(d[i + 2] - bgRgb[2]) > 12
        : d[i + 3] > 8;
      if (isContent) {
        const r = Math.hypot(x - cx, y - cy);
        if (r > max) max = r;
      }
    }
  return max;
}

/** place an image centered on a solid/transparent canvas */
async function composeCanvas({ width, height, content, scaleW, bgHex = null, centerY = 0.5 }) {
  const meta = await sharp(content).metadata();
  const targetW = Math.round(scaleW);
  const targetH = Math.round((meta.height / meta.width) * targetW);
  const resized = await sharp(content)
    .resize(targetW, targetH, { kernel: "lanczos3" }) // uniform scale — never stretch
    .png().toBuffer();
  const base = bgHex
    ? sharp({ create: { width, height, channels: 4, background: bgHex } })
    : sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const out = await base
    .composite([{ input: resized, left: Math.round((width - targetW) / 2), top: Math.round(height * centerY - targetH / 2) }])
    .png().toBuffer();
  return { buf: out, contentW: targetW, contentH: targetH };
}

/* ---------- 3. icon.png — square launcher icon (circle-crop safe) ---------- */
// scale mark to 72% of canvas width; verify worst-case radius stays inside 500/512
const iconTargetW = Math.round(1024 * 0.72);
const icon = await composeCanvas({ width: 1024, height: 1024, content: markBuf, scaleW: iconTargetW, bgHex: BG_HEX, centerY: 0.497 });
const iconRadius = await maxContentRadius(icon.buf, BG_HEX);
console.log(`icon: mark ${icon.contentW}×${icon.contentH}, max content radius ${iconRadius.toFixed(1)} (limit 500 of 512)`);
if (iconRadius > 500) throw new Error("icon artwork would be clipped by circular launcher mask");

/* ---------- 4. adaptive-icon.png — foreground inside 66% safe zone ---------- */
// safe radius = 338px (66% of 1024); target ≤ 322 for margin
const naturalDiag = Math.hypot(markMeta.width / 2, markMeta.height / 2);
const adaptiveScale = 322 / naturalDiag;
const adaptive = await composeCanvas({
  width: 1024, height: 1024, content: markBuf,
  scaleW: markMeta.width * adaptiveScale, centerY: 0.5,
});
const adaptiveRadius = await maxContentRadius(adaptive.buf);
console.log(`adaptive: mark ${adaptive.contentW}×${adaptive.contentH} (${(adaptiveScale * 100).toFixed(1)}%), max radius ${adaptiveRadius.toFixed(1)} (safe zone 338)`);
if (adaptiveRadius > 338) throw new Error("adaptive foreground exceeds Android safe zone");

/* ---------- 5. splash-icon.png — centered transparent lockup on 9:16 canvas ---------- */
// canvas 1440×2560; lockup at 46% canvas width → ~46% screen width after "contain"
const splash = await composeCanvas({ width: 1440, height: 2560, content: lockupBuf, scaleW: 1440 * 0.46, centerY: 0.5 });
console.log(`splash: lockup ${splash.contentW}×${splash.contentH} on 1440×2560 transparent canvas (aspect ${lockupMeta.width}×${lockupMeta.height} preserved)`);

/* ---------- 6. favicon.png — tiny web icon ---------- */
const favicon = await composeCanvas({ width: 128, height: 128, content: markBuf, scaleW: 118, bgHex: BG_HEX, centerY: 0.5 });

/* ---------- 7. write assets ---------- */
await sharp(icon.buf).toFile(path.join(OUT, "icon.png"));
await sharp(adaptive.buf).toFile(path.join(OUT, "adaptive-icon.png"));
await sharp(splash.buf).toFile(path.join(OUT, "splash-icon.png"));
await sharp(favicon.buf).toFile(path.join(OUT, "favicon.png"));
console.log("assets written:", OUT);

/* ---------- 8. hard assertions ---------- */
async function assertAsset(file, w, h) {
  const m = await sharp(path.join(OUT, file)).metadata();
  if (m.width !== w || m.height !== h) throw new Error(`${file}: ${m.width}×${m.height}, expected ${w}×${h}`);
  console.log(`✓ ${file} ${m.width}×${m.height}`);
}
await assertAsset("icon.png", 1024, 1024);
await assertAsset("adaptive-icon.png", 1024, 1024);
await assertAsset("splash-icon.png", 1440, 2560);
await assertAsset("favicon.png", 128, 128);

// adaptive corners must be transparent (foreground, not a full-bleed tile)
{
  const { data: d, info: m } = await sharp(path.join(OUT, "adaptive-icon.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [0, (m.width - 1) * 4, (m.height - 1) * m.width * 4, ((m.height - 1) * m.width + m.width - 1) * 4];
  if (!corners.every(i => d[i + 3] === 0)) throw new Error("adaptive-icon corners not transparent");
  console.log("✓ adaptive-icon corners transparent (foreground only)");
}
// icon corners must be opaque beige (full-bleed background)
{
  const { data: d } = await sharp(path.join(OUT, "icon.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const i of [0, 4, (1024 * 1023) * 4, (1024 * 1024 - 1) * 4])
    if (d[i + 3] !== 255) throw new Error("icon corners not opaque");
  console.log("✓ icon corners opaque beige");
}

/* ---------- 9. verification previews (not committed) ---------- */
const roundedMask = Buffer.from(
  `<svg width="1024" height="1024"><rect width="1024" height="1024" rx="229" ry="229"/></svg>`
);
const circleMask = Buffer.from(
  `<svg width="1024" height="1024"><circle cx="512" cy="512" r="512"/></svg>`
);
const safeCircle = Buffer.from(
  `<svg width="1024" height="1024"><circle cx="512" cy="512" r="338" fill="none" stroke="#e11d48" stroke-width="6" stroke-dasharray="18 12"/></svg>`
);

// a) launcher crop preview: square | rounded (iOS) | circle (Android) on dark
{
  const sq = await sharp(path.join(OUT, "icon.png")).resize(320, 320).png().toBuffer();
  const mask320 = Buffer.from(
    `<svg width="320" height="320"><rect width="320" height="320" rx="72" ry="72"/></svg>`
  );
  const circ320 = Buffer.from(
    `<svg width="320" height="320"><circle cx="160" cy="160" r="160"/></svg>`
  );
  const rounded = await sharp(sq).composite([{ input: mask320, blend: "dest-in" }]).png().toBuffer();
  const circ = await sharp(sq).composite([{ input: circ320, blend: "dest-in" }]).png().toBuffer();
  await sharp({ create: { width: 1080, height: 360, channels: 4, background: "#3f3a34" } })
    .composite([
      { input: sq, left: 30, top: 20 },
      { input: rounded, left: 380, top: 20 },
      { input: circ, left: 730, top: 20 },
    ]).png().toFile(path.join(PREVIEWS, "icon-crop-preview.png"));
}

// b) adaptive safe-zone preview: beige bg + foreground + 66% safe circle
{
  const fg = await sharp(path.join(OUT, "adaptive-icon.png")).resize(512, 512).png().toBuffer();
  const zone = await sharp(safeCircle).resize(512, 512).png().toBuffer();
  const circ = await sharp(circleMask).resize(512, 512).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: BG_HEX } })
    .composite([{ input: circ, blend: "dest-in" }, { input: fg }, { input: zone }])
    .png().toFile(path.join(PREVIEWS, "adaptive-safe-zone-preview.png"));
}

// c) splash preview: portrait 1080×2340 beige + contained splash-icon (as Expo renders)
{
  // contain-scale 1440×2560 into 1080×2340 → scale = min(0.75, 0.914) = 0.75
  const scale = Math.min(1080 / 1440, 2340 / 2560);
  const rw = Math.round(1440 * scale), rh = Math.round(2560 * scale);
  const img = await sharp(path.join(OUT, "splash-icon.png")).resize(rw, rh).png().toBuffer();
  await sharp({ create: { width: 1080, height: 2340, channels: 4, background: BG_HEX } })
    .composite([{ input: img, left: Math.round((1080 - rw) / 2), top: Math.round((2340 - rh) / 2) }])
    .png().toFile(path.join(PREVIEWS, "splash-portrait-preview.png"));
}
console.log("previews written:", PREVIEWS);
