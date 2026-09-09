import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outfile = join(root, 'dist', 'Numbers.html');

await build({
  entryPoints: [join(root, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: join(root, 'dist', 'app.js'),
});

const js = readFileSync(join(root, 'dist', 'app.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const inlineHtml = html.replace(
  /<script type="module" src="\/src\/main\.js"><\/script>/,
  () => `<script>${js}</script>`
);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(outfile, inlineHtml, 'utf8');
rmSync(join(root, 'dist', 'app.js')); // 清理中间 JS 产物，只留单文件
console.log('已生成 dist/Numbers.html（单文件）');
