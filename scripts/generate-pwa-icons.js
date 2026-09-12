import fs from 'fs';
import { PNG } from 'pngjs';

function drawIcon(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });

  // Theme colors
  const bgR = 11, bgG = 19, bgB = 23; // #0b1317
  const tealR = 13, tealG = 148, tealB = 136; // #0d9488
  const tealDarkR = 15, tealDarkG = 118, tealDarkB = 110; // #0f766e
  const whiteR = 255, whiteG = 255, whiteB = 255;
  const accentLightR = 45, accentLightG = 212, accentLightB = 191; // #2dd4bf

  const center = size / 2;
  const radius = isMaskable ? size * 0.42 : size * 0.44;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Base background fill
      png.data[idx] = bgR;
      png.data[idx + 1] = bgG;
      png.data[idx + 2] = bgB;
      png.data[idx + 3] = 255;

      // Distance from center
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded background container / badge
      // Rounded box calculation
      const boxSize = radius * 1.6;
      const cornerRadius = radius * 0.45;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const qx = Math.max(0, absX - (boxSize / 2 - cornerRadius));
      const qy = Math.max(0, absY - (boxSize / 2 - cornerRadius));
      const boxDist = Math.sqrt(qx * qx + qy * qy);

      if (absX <= boxSize / 2 && absY <= boxSize / 2 && boxDist <= cornerRadius) {
        // Gradient from teal to dark teal
        const factor = (y / size);
        const curR = Math.round(tealR * (1 - factor) + tealDarkR * factor);
        const curG = Math.round(tealG * (1 - factor) + tealDarkG * factor);
        const curB = Math.round(tealB * (1 - factor) + tealDarkB * factor);

        png.data[idx] = curR;
        png.data[idx + 1] = curG;
        png.data[idx + 2] = curB;
        png.data[idx + 3] = 255;

        // Border highlight
        if (boxDist >= cornerRadius - 2 || (absX >= boxSize / 2 - 2 && absY <= boxSize / 2 - cornerRadius) || (absY >= boxSize / 2 - 2 && absX <= boxSize / 2 - cornerRadius)) {
          png.data[idx] = accentLightR;
          png.data[idx + 1] = accentLightG;
          png.data[idx + 2] = accentLightB;
        }

        // Graduation cap diamond shape in center
        // Center of cap: center, center - radius * 0.15
        const capY = center - radius * 0.15;
        const cdx = Math.abs(x - center);
        const cdy = Math.abs(y - capY);
        const diamondWidth = radius * 0.65;
        const diamondHeight = radius * 0.32;

        if (cdx / diamondWidth + cdy / diamondHeight <= 1) {
          png.data[idx] = whiteR;
          png.data[idx + 1] = whiteG;
          png.data[idx + 2] = whiteB;
        }

        // Cap base band below diamond
        const bandTop = capY + diamondHeight * 0.35;
        const bandBottom = capY + diamondHeight * 1.1;
        const bandHalfWidth = radius * 0.35;
        if (y >= bandTop && y <= bandBottom && Math.abs(x - center) <= bandHalfWidth) {
          png.data[idx] = whiteR;
          png.data[idx + 1] = whiteG;
          png.data[idx + 2] = whiteB;
        }

        // Tassel line on right
        if (x >= center + diamondWidth * 0.55 && x <= center + diamondWidth * 0.62 && y >= capY && y <= capY + diamondHeight * 1.3) {
          png.data[idx] = accentLightR;
          png.data[idx + 1] = accentLightG;
          png.data[idx + 2] = accentLightB;
        }

        // Tassel drop
        const tDropX = x - (center + diamondWidth * 0.58);
        const tDropY = y - (capY + diamondHeight * 1.35);
        if (Math.sqrt(tDropX * tDropX + tDropY * tDropY) <= radius * 0.08) {
          png.data[idx] = accentLightR;
          png.data[idx + 1] = accentLightG;
          png.data[idx + 2] = accentLightB;
        }
      }
    }
  }

  return png;
}

const icons = [
  { name: 'public/pwa-192x192.png', size: 192, maskable: false },
  { name: 'public/pwa-512x512.png', size: 512, maskable: false },
  { name: 'public/maskable-icon-512x512.png', size: 512, maskable: true },
  { name: 'public/apple-touch-icon-180x180.png', size: 180, maskable: false },
];

for (const icon of icons) {
  const png = drawIcon(icon.size, icon.maskable);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(icon.name, buffer);
  console.log(`Generated ${icon.name} (${icon.size}x${icon.size})`);
}
