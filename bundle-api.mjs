import { build } from 'vite';

async function bundle() {
  await build({
    configFile: false,
    build: {
      ssr: 'api/_analyse.ts',
      outDir: 'api',
      emptyOutDir: false,
      copyPublicDir: false,
      rollupOptions: {
        external: ['viem', 'viem/chains'],
        output: {
          format: 'esm',
          entryFileNames: 'analyse.js',
        },
      },
    },
  });
  console.log('Successfully bundled api/analyse.js');

  await build({
    configFile: false,
    build: {
      ssr: 'api/_review.ts',
      outDir: 'api',
      emptyOutDir: false,
      copyPublicDir: false,
      rollupOptions: {
        external: ['viem', 'viem/chains'],
        output: {
          format: 'esm',
          entryFileNames: 'review.js',
        },
      },
    },
  });
  console.log('Successfully bundled api/review.js');

  await build({
    configFile: false,
    build: {
      ssr: 'api/_health.ts',
      outDir: 'api',
      emptyOutDir: false,
      copyPublicDir: false,
      rollupOptions: {
        external: ['viem', 'viem/chains'],
        output: {
          format: 'esm',
          entryFileNames: 'health.js',
        },
      },
    },
  });
  console.log('Successfully bundled api/health.js');
}

bundle();
