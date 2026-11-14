import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveServModel,
  getServModelMetadata,
  VALID_SERV_MODELS,
} from '../../server/providers/serv-model';

describe('OpenServ SERV Model Resolver (Step 3)', () => {
  it('resolves all valid models from the verified catalog', () => {
    for (const valid of VALID_SERV_MODELS) {
      expect(resolveServModel(valid)).toBe(valid);
      const meta = getServModelMetadata(valid);
      expect(meta.modelId).toBe(valid);
      expect(meta.pricing.rawInput).toBeGreaterThan(0);
      expect(meta.pricing.rawOutput).toBeGreaterThan(0);
    }
  });

  it('defaults to serv-swift when env is unset or empty', () => {
    expect(resolveServModel('')).toBe('serv-swift');
    expect(resolveServModel(undefined)).toBe('serv-swift');
  });

  it('throws synchronously on invalid or non-existent model IDs', () => {
    expect(() => resolveServModel('invalid-model')).toThrow(/Invalid SERV_MODEL "invalid-model"/);
    expect(() => resolveServModel('gpt-4o-mini')).toThrow(/Invalid SERV_MODEL "gpt-4o-mini"/);
    expect(() => resolveServModel('4o-mini')).toThrow(/Invalid SERV_MODEL "4o-mini"/);
    expect(() => resolveServModel('serv-mini')).toThrow(/Invalid SERV_MODEL "serv-mini"/);
  });

  it('verifies that no legacy model literals (4o-mini, serv-mini) exist in source outside resolver/tests', () => {
    const forbiddenPatterns = [/\b4o-mini\b/, /\bserv-mini\b/];
    const scannedDirs = ['server', 'src', 'scripts'];

    function scanDir(dir: string): string[] {
      const violations: string[] = [];
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const st = statSync(fullPath);
        if (st.isDirectory()) {
          violations.push(...scanDir(fullPath));
        } else if (
          (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) &&
          !fullPath.includes('serv-model.ts') &&
          !fullPath.includes('serv-model.test.ts')
        ) {
          const content = readFileSync(fullPath, 'utf8');
          for (const pat of forbiddenPatterns) {
            if (pat.test(content)) {
              violations.push(`${fullPath}: matches forbidden pattern ${pat.source}`);
            }
          }
        }
      }
      return violations;
    }

    const allViolations: string[] = [];
    for (const d of scannedDirs) {
      allViolations.push(...scanDir(d));
    }

    expect(allViolations).toEqual([]);
  });
});
