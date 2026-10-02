// Builds the Electron main process and preload script into dist-electron/.
// The renderer is built separately by `vite build` (vite.config.ts).
import { build } from 'vite';
import { builtinModules } from 'node:module';

const external = [
  'electron',
  'better-sqlite3',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

for (const [name, entry] of [
  ['main', 'src/main/main.ts'],
  ['preload', 'src/main/preload.ts'],
]) {
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: 'dist-electron',
      emptyOutDir: name === 'main',
      sourcemap: true,
      minify: false,
      target: 'node22',
      lib: { entry, formats: ['cjs'], fileName: () => `${name}.cjs` },
      rollupOptions: { external },
    },
  });
}
console.log('dist-electron built');
