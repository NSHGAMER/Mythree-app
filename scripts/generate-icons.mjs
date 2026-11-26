// Generates PWA icons, favicon and optimised brand images from /brand sources.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const LOGO = 'brand/mythree-logo.jpeg';
const PROMO = 'brand/sanskritagriham-promo.jpeg';
const OUT = 'public';
const CREAM = { r: 251, g: 246, b: 236, alpha: 1 };

await mkdir(`${OUT}/icons`, { recursive: true });
await mkdir(`${OUT}/images`, { recursive: true });

// The source logo is a JPEG with dark corners; cut it to a circle so it sits cleanly on any background.
async function circularLogo(size) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#fff"/></svg>`,
  );
  return sharp(LOGO)
    .resize(size, size, { kernel: 'lanczos3' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

// Transparent "any" icons
for (const size of [64, 192, 512]) {
  await sharp(await circularLogo(size)).toFile(`${OUT}/icons/icon-${size}.png`);
}

// Maskable icons need the artwork inside the 80% safe zone on a solid background
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.78);
  await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: await circularLogo(inner), gravity: 'center' }])
    .png()
    .toFile(`${OUT}/icons/maskable-${size}.png`);
}

// Apple touch icon (iOS ignores transparency, so use cream background)
await sharp({ create: { width: 180, height: 180, channels: 4, background: CREAM } })
  .composite([{ input: await circularLogo(160), gravity: 'center' }])
  .png()
  .toFile(`${OUT}/icons/apple-touch-icon.png`);

await sharp(await circularLogo(48)).toFile(`${OUT}/favicon.png`);

// Logo used in the UI (splash, header)
await sharp(await circularLogo(280)).webp({ quality: 92 }).toFile(`${OUT}/images/logo.webp`);
await sharp(await circularLogo(280)).png().toFile(`${OUT}/images/logo.png`);

// Promotional artwork, responsive sizes
for (const w of [480, 800, 1080]) {
  await sharp(PROMO).resize({ width: w }).webp({ quality: 80 }).toFile(`${OUT}/images/promo-${w}.webp`);
}
await sharp(PROMO).resize({ width: 1080 }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${OUT}/images/promo-1080.jpg`);

// Open Graph image 1200x630
await sharp(PROMO).resize(1200, 630, { fit: 'cover', position: 'top' }).jpeg({ quality: 80 }).toFile(`${OUT}/images/og.jpg`);

console.log('Icons and images generated.');
