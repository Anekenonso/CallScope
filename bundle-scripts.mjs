import { build } from 'vite';

async function bundleScript(entry, outFile) {
  await build({
    configFile: false,
    build: {
      ssr: entry,
      outDir: 'scripts',
      emptyOutDir: false,
      copyPublicDir: false,
      rollupOptions: {
        external: ['viem', 'viem/chains', 'node:fs', 'node:path'],
        output: {
          format: 'esm',
          entryFileNames: outFile,
        },
      },
    },
  });
  console.log(`Bundled ${entry} -> scripts/${outFile}`);
}

async function main() {
  await bundleScript('scripts/run-guard-experiment.ts', 'run-guard-experiment.mjs');
  await bundleScript('scripts/run-model-comparison.ts', 'run-model-comparison.mjs');
  await bundleScript('scripts/run-tier-benchmarks.ts', 'run-tier-benchmarks.mjs');
  await bundleScript('scripts/run-instant-success-table.ts', 'run-instant-success-table.mjs');
}

main();
