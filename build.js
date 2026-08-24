import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outfile = join(root, 'dist', 'app.js');

await build({
  entryPoints: [join(root, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile,
});

const js = readFileSync(outfile, 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const inlineHtml = html.replace(
  /<script type="module" src="\/src\/main\.js"><\/script>/,
  () => `<script>${js}</script>`
);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), inlineHtml, 'utf8');
rmSync(outfile); // 清理中间 JS 产物，只留单文件
console.log('已生成 dist/index.html（单文件）');
