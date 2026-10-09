// แปลงไอคอน SVG ใน site/icons เป็น PNG (ไอคอนแอป, maskable, apple-touch, รูปแชร์ og)
// รันเมื่อแก้ SVG เท่านั้น: node scripts/make-icons.mjs  (ผลลัพธ์ถูก commit ไว้แล้ว)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'icons');

function render(svgFile, width, outFile) {
  const svg = readFileSync(join(dir, svgFile));
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(join(dir, outFile), png);
  console.log(`${svgFile} -> ${outFile} (${width}px, ${png.length} bytes)`);
}

render('icon.svg', 192, 'icon-192.png');
render('icon.svg', 512, 'icon-512.png');
render('icon.svg', 180, 'apple-touch-icon.png');
render('icon.svg', 32, 'favicon-32.png');
render('icon-maskable.svg', 512, 'icon-maskable-512.png');
render('og.svg', 1200, 'og-image.png');
