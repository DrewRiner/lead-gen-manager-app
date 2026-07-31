// Generates the PWA/home-screen icon PNGs into /public from one inline SVG.
// Uses sharp (already present as a Next transitive dep). Re-run with:
//   node scripts/gen-pwa-icons.mjs
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public");
mkdirSync(outDir, { recursive: true });

// Indigo accent (matches --primary) background, white "Blue Carrot" mark.
const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#4f46e5"/>
  <g fill="#ffffff">
    <path d="M256 156 C246 116 226 102 202 96 C220 118 230 138 240 162 Z"/>
    <path d="M256 156 C256 108 262 84 272 66 C282 98 280 128 270 160 Z"/>
    <path d="M256 156 C266 116 286 102 310 96 C292 118 282 138 272 162 Z"/>
    <path d="M210 174 C240 163 272 163 302 174 L268 392 C260 408 252 408 244 392 Z"/>
  </g>
</svg>`;

const buf = Buffer.from(svg);
const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-icon.png", size: 180 },
  { name: "favicon.png", size: 48 },
];

for (const t of targets) {
  await sharp(buf).resize(t.size, t.size).png().toFile(join(outDir, t.name));
  console.log("wrote", t.name);
}
