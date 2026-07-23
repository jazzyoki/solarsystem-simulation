import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Vitest configuration', () => {
  it('excludes isolated worktrees from test discovery', () => {
    const config = readFileSync(resolve(import.meta.dirname, '../vite.config.ts'), 'utf8');

    expect(config).toContain('configDefaults');
    expect(config).toContain("exclude: [...configDefaults.exclude, '.worktrees/**']");
  });
});
