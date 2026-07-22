import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = fileURLToPath(new URL('../artwork/social-preview.svg', import.meta.url));
const defaultOutput = fileURLToPath(new URL('../public/social-preview.png', import.meta.url));
const requestedOutput = process.argv[2];
const output = requestedOutput ? (isAbsolute(requestedOutput) ? requestedOutput : resolve(requestedOutput)) : defaultOutput;
const fontDirectory = fileURLToPath(new URL('../node_modules/dejavu-fonts-ttf/ttf/', import.meta.url));
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'social-preview-fontconfig-'));
const fontConfig = join(temporaryDirectory, 'fonts.conf');
const xmlEscape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

await writeFile(
  fontConfig,
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${xmlEscape(fontDirectory)}</dir><cachedir>${xmlEscape(temporaryDirectory)}</cachedir></fontconfig>`,
);
process.env.FONTCONFIG_FILE = fontConfig;

try {
  const { default: sharp } = await import('sharp');
  await sharp(input).png({ compressionLevel: 9 }).toFile(output);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
