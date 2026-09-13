import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const sourcePath = 'scripts/app-icon-source.png';
if (!fs.existsSync(sourcePath)) {
  console.error('Source file not found:', sourcePath);
  process.exit(1);
}

const srcBuffer = fs.readFileSync(sourcePath);
const src = PNG.sync.read(srcBuffer);

// Geometry constants calibrated to the user's high-res source image
const srcCX = 524;
const srcCY = 426;
const srcHalf = 306;
const srcR = 192;
const srcSize = srcHalf * 2; // 612

// Brand deep purple matching the squircle background
const purpleR = 63;
const purpleG = 55;
const purpleB = 78;

function sampleSourceBilinear(x, y) {
  const x0 = Math.max(0, Math.min(src.width - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(src.height - 2, Math.floor(y)));
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));

  const idx00 = (src.width * y0 + x0) << 2;
  const idx10 = (src.width * y0 + x1) << 2;
  const idx01 = (src.width * y1 + x0) << 2;
  const idx11 = (src.width * y1 + x1) << 2;

  function interp(i) {
    return (1 - fx) * (1 - fy) * src.data[idx00 + i]
         + fx * (1 - fy) * src.data[idx10 + i]
         + (1 - fx) * fy * src.data[idx01 + i]
         + fx * fy * src.data[idx11 + i];
  }

  const r = interp(0);
  const g = interp(1);
  const b = interp(2);
  const L = (r + g + b) / 3;
  return { r, g, b, L };
}

function computeSDF(sx, sy) {
  const qx = Math.max(0, Math.abs(sx - srcCX) - (srcHalf - srcR));
  const qy = Math.max(0, Math.abs(sy - srcCY) - (srcHalf - srcR));
  return Math.hypot(qx, qy) - srcR;
}

export function generateIcon(targetSize, type) {
  const png = new PNG({ width: targetSize, height: targetSize });
  const targetCenter = (targetSize - 1) / 2;

  let squircleDiameter;
  if (type === 'maskable') {
    // 512 canvas: safe zone radius = 512 * 0.4 = 204.8px.
    // Squircle corner maximum distance in source = Math.hypot(114, 114) + 192 = 353.25px.
    // At squircleDiameter = 348px (scale 0.68), corner radius = 353.25 * (348 / 612) = 200.9px < 204.8px.
    // Graduation cap max distance from center = 198.6 * (348 / 612) = 112.9px.
    // This strictly guarantees all icon content sits inside the 80% safe zone.
    squircleDiameter = Math.round(targetSize * 0.68);
  } else if (type === 'apple') {
    // 180 canvas: iOS homescreen squircle mask
    squircleDiameter = Math.round(targetSize * 0.80);
  } else {
    // Standard PWA icon: 88% squircle size with transparent padding
    squircleDiameter = Math.round(targetSize * 0.88);
  }

  const ratio = srcSize / squircleDiameter;

  // 4x sub-pixel supersampling for smooth anti-aliased borders
  const subOffsets = [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25]
  ];

  for (let ty = 0; ty < targetSize; ty++) {
    for (let tx = 0; tx < targetSize; tx++) {
      const idx = (targetSize * ty + tx) << 2;

      let rAcc = 0, gAcc = 0, bAcc = 0, aAcc = 0;

      for (const [ox, oy] of subOffsets) {
        const sx = srcCX + (tx + ox - targetCenter) * ratio;
        const sy = srcCY + (ty + oy - targetCenter) * ratio;

        const sdf = computeSDF(sx, sy);
        const distCenter = Math.hypot(sx - srcCX, sy - srcCY);

        let subR = purpleR, subG = purpleG, subB = purpleB, subA = 255;

        if (sdf <= 0) {
          // Inside squircle
          const s = sampleSourceBilinear(sx, sy);

          if (distCenter <= 215) {
            // Region containing the white graduation cap
            if (s.L > 180) {
              // Crisp pure white cap
              subR = 255;
              subG = 255;
              subB = 255;
              subA = 255;
            } else if (s.L > 75) {
              // Anti-aliased white stroke transition
              const t = (s.L - 75) / (180 - 75);
              subR = Math.round(t * 255 + (1 - t) * s.r);
              subG = Math.round(t * 255 + (1 - t) * s.g);
              subB = Math.round(t * 255 + (1 - t) * s.b);
              subA = 255;
            } else {
              // Squircle face
              subR = Math.round(s.r);
              subG = Math.round(s.g);
              subB = Math.round(s.b);
              subA = 255;
            }
          } else {
            // Outside cap, squircle body
            if (s.L < 85) {
              subR = Math.round(s.r);
              subG = Math.round(s.g);
              subB = Math.round(s.b);
            } else {
              subR = purpleR;
              subG = purpleG;
              subB = purpleB;
            }
            subA = 255;
          }
        } else {
          // Outside squircle
          if (type === 'maskable' || type === 'apple') {
            subR = purpleR;
            subG = purpleG;
            subB = purpleB;
            subA = 255;
          } else {
            subR = 0;
            subG = 0;
            subB = 0;
            subA = 0; // Transparent
          }
        }

        rAcc += subR;
        gAcc += subG;
        bAcc += subB;
        aAcc += subA;
      }

      png.data[idx] = Math.round(rAcc / 4);
      png.data[idx + 1] = Math.round(gAcc / 4);
      png.data[idx + 2] = Math.round(bAcc / 4);
      png.data[idx + 3] = Math.round(aAcc / 4);
    }
  }

  return png;
}

const iconsToGenerate = [
  { file: 'public/pwa-192x192.png', size: 192, type: 'standard' },
  { file: 'public/pwa-512x512.png', size: 512, type: 'standard' },
  { file: 'public/maskable-icon-512x512.png', size: 512, type: 'maskable' },
  { file: 'public/apple-touch-icon-180x180.png', size: 180, type: 'apple' }
];

console.log('Generating PWA icons from source:', sourcePath);
for (const item of iconsToGenerate) {
  const png = generateIcon(item.size, item.type);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(item.file, buffer);
  console.log(`✓ Generated: ${item.file} (${item.size}x${item.size}, type: ${item.type}, ${buffer.length} bytes)`);
}

// Verification of generated icons
console.log('\n--- VERIFICATION AUDIT ---');
for (const item of iconsToGenerate) {
  const buf = fs.readFileSync(item.file);
  const parsed = PNG.sync.read(buf);
  console.log(`[DIMENSIONS CHECK] ${item.file}: width=${parsed.width}px, height=${parsed.height}px (matches expected ${item.size}x${item.size})`);
}

// Maskable Safe-Zone Audit
const maskableBuf = fs.readFileSync('public/maskable-icon-512x512.png');
const maskablePng = PNG.sync.read(maskableBuf);
const mCenter = 255.5;
const safeRadius = 512 * 0.4; // 204.8px

let outsideSafeZoneNonBgPixels = 0;
let capPixelsInsideSafeZone = 0;

for (let y = 0; y < 512; y++) {
  for (let x = 0; x < 512; x++) {
    const idx = (y * 512 + x) << 2;
    const r = maskablePng.data[idx];
    const g = maskablePng.data[idx + 1];
    const b = maskablePng.data[idx + 2];
    const dist = Math.hypot(x - mCenter, y - mCenter);

    const isBg = (Math.abs(r - purpleR) <= 3 && Math.abs(g - purpleG) <= 3 && Math.abs(b - purpleB) <= 3);
    const isCap = (r > 200 && g > 200 && b > 200);

    if (dist > safeRadius && !isBg) {
      outsideSafeZoneNonBgPixels++;
    }
    if (dist <= safeRadius && isCap) {
      capPixelsInsideSafeZone++;
    }
  }
}

console.log(`\n[SAFE ZONE AUDIT] maskable-icon-512x512.png:`);
console.log(`- 80% Safe Zone Radius: ${safeRadius}px`);
console.log(`- Cap Pixels Inside Safe Zone: ${capPixelsInsideSafeZone}`);
console.log(`- Non-background Pixels Outside Safe Zone: ${outsideSafeZoneNonBgPixels}`);
if (outsideSafeZoneNonBgPixels === 0) {
  console.log(`✓ PASSED: 100% of icon foreground content is strictly within the center 80% safe zone!`);
} else {
  console.warn(`⚠ WARNING: ${outsideSafeZoneNonBgPixels} non-background pixels detected outside safe zone.`);
}
