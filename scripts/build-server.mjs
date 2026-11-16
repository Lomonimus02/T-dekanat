import { build } from 'esbuild';
// Сервер собирается в самодостаточные файлы: на продакшене не нужен node_modules.
const common = { bundle: true, platform: 'node', format: 'esm', target: 'node20', external: ['pg-native'], sourcemap: false, logLevel: 'info', legalComments: 'linked',
  banner: { js: "import { createRequire as __cr } from 'module'; import { fileURLToPath as __fu } from 'url'; import { dirname as __dn } from 'path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);" } };
await build({ ...common, entryPoints: ['server/index.ts'], outfile: 'dist/server.js' });
await build({ ...common, entryPoints: ['server/migrate.ts'], outfile: 'dist/migrate.js' });
await build({ ...common, entryPoints: ['server/seed.ts'], outfile: 'dist/seed.js' });
