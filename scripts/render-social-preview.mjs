import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const input = fileURLToPath(new URL('../artwork/social-preview.svg', import.meta.url));
const output = fileURLToPath(new URL('../public/social-preview.png', import.meta.url));

await sharp(input).png({ compressionLevel: 9 }).toFile(output);
