import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export async function buildSpriteAnchors(root = process.cwd()) {
  const anchors = {};
  for (const folder of ['creatures', 'environment', 'people']) {
    const directory = path.join(root, 'public', 'art', folder);
    for (const name of fs.readdirSync(directory).filter(file => file.endsWith('.png')).sort()) {
      const file = path.join(directory, name);
      const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const frames = info.width > info.height && info.width % info.height === 0 && info.width / info.height <= 6
        ? info.width / info.height : 1;
      const frameWidth = info.width / frames;
      const threshold = folder === 'environment' ? 51 : 115;
      const feet = [];
      for (let frame = 0; frame < frames; frame++) {
        let lastOpaqueRow = -1;
        for (let y = info.height - 1; y >= 0 && lastOpaqueRow < 0; y--) {
          for (let x = frame * frameWidth; x < (frame + 1) * frameWidth; x++) {
            if (data[(y * info.width + x) * info.channels + 3] >= threshold) {
              lastOpaqueRow = y;
              break;
            }
          }
        }
        feet.push(lastOpaqueRow < 0 ? 0 : Number(((info.height - 1 - lastOpaqueRow) / info.height).toFixed(5)));
      }
      anchors[`/art/${folder}/${name}`] = feet;
    }
  }
  const destination = path.join(root, 'src', 'render', 'spriteAnchors.ts');
  fs.writeFileSync(destination,
    `// Generated from the last visible pixels of each PNG. Run npm run art:anchors after changing art.\n`+
    `export const SPRITE_FOOT_V: Record<string, readonly number[]> = ${JSON.stringify(anchors, null, 2)};\n\n`+
    `export function spriteFootV(path: string, frame = 0): number {\n`+
    `  return SPRITE_FOOT_V[path]?.[frame] ?? 0;\n}\n`);
  return Object.keys(anchors).length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Measured ${await buildSpriteAnchors()} sprite anchors.`);
}
