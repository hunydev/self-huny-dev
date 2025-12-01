import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iconsDir = join(__dirname, '../public/icons');

// Read SVG file
const svg192 = readFileSync(join(iconsDir, 'icon-192.svg'));
const svg512 = readFileSync(join(iconsDir, 'icon-512.svg'));

async function generateIcons() {
  // Generate 192x192 PNG
  await sharp(svg192)
    .resize(192, 192)
    .png()
    .toFile(join(iconsDir, 'icon-192.png'));
  console.log('Generated icon-192.png');

  // Generate 512x512 PNG
  await sharp(svg512)
    .resize(512, 512)
    .png()
    .toFile(join(iconsDir, 'icon-512.png'));
  console.log('Generated icon-512.png');

  // Generate Apple touch icon (180x180)
  await sharp(svg192)
    .resize(180, 180)
    .png()
    .toFile(join(iconsDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Generate favicon.ico compatible PNG (32x32)
  await sharp(svg192)
    .resize(32, 32)
    .png()
    .toFile(join(iconsDir, 'favicon-32.png'));
  console.log('Generated favicon-32.png');

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
