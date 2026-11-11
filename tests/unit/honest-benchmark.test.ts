import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Task 8: Honest Sponsor Benchmark Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('proves scripts/compare-sponsors.ts contains zero latency floors (no Math.max(..., 28))', () => {
    const scriptPath = resolve(process.cwd(), 'scripts/compare-sponsors.ts');
    const content = readFileSync(scriptPath, 'utf-8');

    expect(content).not.toContain('Math.max(');
    expect(content).not.toContain(', 28)');
  });

  it('proves package.json provides separate sim and live benchmark scripts', () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    expect(pkg.scripts['compare:sponsors:sim']).toBeDefined();
    expect(pkg.scripts['compare:sponsors:live']).toBeDefined();
    expect(pkg.scripts['compare:sponsors:sim']).toContain('--mode=sim');
    expect(pkg.scripts['compare:sponsors:live']).toContain('--mode=live');
  });

  it('proves generated docs/sponsor-impact.md carries explicit [SIMULATED] banner when run offline', () => {
    const reportPath = resolve(process.cwd(), 'docs/sponsor-impact.md');
    expect(existsSync(reportPath)).toBe(true);

    const reportContent = readFileSync(reportPath, 'utf-8');
    expect(reportContent).toContain('[SIMULATED BENCHMARK]');
    expect(reportContent).toContain('simulated offline mode');
    expect(reportContent).toContain('pnpm compare:sponsors:sim');
    expect(reportContent).toContain('100% INVARIANT');
  });
});

