import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const srcSvg = path.join(root, 'public', 'favicon.svg');
const out192 = path.join(root, 'public', 'icon-192.png');
const out512 = path.join(root, 'public', 'icon-512.png');
const outApple = path.join(root, 'public', 'apple-touch-icon.png');

async function main() {
  const svg = await fs.readFile(srcSvg);
  await sharp(svg, { density: 384 }) // increase density for crisp rasterization
    .resize(192, 192)
    .png()
    .toFile(out192);
  await sharp(svg, { density: 1024 })
    .resize(512, 512)
    .png()
    .toFile(out512);
  await sharp(svg, { density: 360 })
    .resize(180, 180)
    .png()
    .toFile(outApple);
  console.log('Generated icons: icon-192.png, icon-512.png, apple-touch-icon.png');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exitCode = 1;
});

