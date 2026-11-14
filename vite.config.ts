/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables into process.env for server-side API handler in dev
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of Object.keys(env)) {
    if (!process.env[key]) {
      process.env[key] = env[key];
    }
  }

  return {
    plugins: [
      react(),
      {
        name: 'api-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/analyse' && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  const { executeAnalysis } = await import('./api/analyse');
                  const parsed = JSON.parse(body || '{}');
                  const result = await executeAnalysis(parsed);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(result));
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : 'Internal Server Error';
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Analysis Error', details: message }));
                }
              });
              return;
            }
            next();
          });
        },
      },
    ],
    test: {
      globals: true,
      environment: 'node',
      fileParallelism: false,
      testTimeout: 45000,
      include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    },
    server: {
      port: 5173,
    },
  };
});
