import { describe, it, expect } from 'vitest';
import { normalizeReviewItem } from '../../server/providers/review-normalizer';
import type { Finding, ProposalAction } from '../../src/types/analysis';

describe('Task 2: Sponsor review rendering and structure', () => {
  it('normalizes exact production payload shape {type, issue, evidence}', () => {
    const prodPayload = {
      type: 'unsupported_claim',
      issue: 'The proposal description claims 100 tokens, but the action transfers 500',
      evidence: 'Action 0 calldata specifies value 500000000',
    };

    const item = normalizeReviewItem(prodPayload);
    expect(item.kind).toBe('unsupported_claim');
    expect(item.issue).toBe('The proposal description claims 100 tokens, but the action transfers 500');
    expect(item.evidence).toBe('Action 0 calldata specifies value 500000000');
  });

  it('normalizes alternative keys: detail, description, observation, message, title', () => {
    const item1 = normalizeReviewItem({ type: 'risk', detail: 'Centralization hazard detected' });
    expect(item1.kind).toBe('risk');
    expect(item1.issue).toBe('Centralization hazard detected');

    const item2 = normalizeReviewItem({ category: 'contradiction', message: 'Mismatch between address and name' });
    expect(item2.kind).toBe('contradiction');
    expect(item2.issue).toBe('Mismatch between address and name');
  });

  it('never outputs raw JSON syntax into UI text for unknown object shapes', () => {
    const unknownShape = { foo: 'bar', baz: 42 };
    const item = normalizeReviewItem(unknownShape);
    expect(item.kind).toBe('note');
    expect(item.issue).not.toContain('{');
    expect(item.issue).not.toContain('}');
    expect(item.issue).toContain('foo: bar');
    expect(item.issue).toContain('baz: 42');
  });

  it('normalizes prefixed string items', () => {
    const item = normalizeReviewItem('[risk] Excessive token approval without expiration');
    expect(item.kind).toBe('risk');
    expect(item.issue).toBe('Excessive token approval without expiration');
  });

  it('filters Dolphin items: caps at 3 and drops items without valid actionRef or findingRef', () => {
    const actions: ProposalAction[] = [
      {
        index: 0,
        target: '0x1111111111111111111111111111111111111111',
        value: '0',
        signature: '',
        selector: '0x2f2ff15d',
        decoded: true,
        rawCalldata: '0x',
      },
    ];

    const findings: Finding[] = [
      {
        id: 'SENSITIVE_ROLE_0',
        severity: 'high',
        title: 'Grants sensitive role',
        description: 'Grants admin role',
        verified: true,
        whyItMatters: 'Admin role allows arbitrary actions',
      },
    ];

    const rawDolphinItems = [
      { kind: 'risk', issue: 'Valid action ref 0', actionRef: 0 },
      { kind: 'risk', issue: 'Invalid action ref 5', actionRef: 5 },
      { kind: 'contradiction', issue: 'Valid finding ref', findingRef: 'SENSITIVE_ROLE_0' },
      { kind: 'note', issue: 'Invalid finding ref', findingRef: 'NON_EXISTENT' },
      { kind: 'unsupported_claim', issue: 'Missing any ref' },
      { kind: 'risk', issue: 'Another valid action ref 0', actionRef: 0 },
      { kind: 'supported', issue: 'Fourth valid item', actionRef: 0 },
    ];

    const normalized = rawDolphinItems.map(normalizeReviewItem);
    const valid = normalized
      .filter((item) => {
        if (item.actionRef !== undefined) {
          return item.actionRef >= 0 && item.actionRef < actions.length;
        }
        if (item.findingRef) {
          return findings.some(
            (f) =>
              f.id.toLowerCase() === item.findingRef?.toLowerCase() ||
              f.title.toLowerCase().includes(item.findingRef?.toLowerCase() || '')
          );
        }
        return false;
      })
      .slice(0, 3);

    expect(valid).toHaveLength(3);
    expect(valid[0].issue).toBe('Valid action ref 0');
    expect(valid[1].issue).toBe('Valid finding ref');
    expect(valid[2].issue).toBe('Another valid action ref 0');
  });
});

