import type { ReviewItem, ReviewItemKind } from '../../src/types/analysis';

const VALID_KINDS: Set<ReviewItemKind> = new Set([
  'supported',
  'unsupported_claim',
  'risk',
  'contradiction',
  'note',
]);

function normalizeKind(rawKind: unknown): ReviewItemKind {
  if (typeof rawKind !== 'string') return 'note';
  const lower = rawKind.trim().toLowerCase();
  if (VALID_KINDS.has(lower as ReviewItemKind)) {
    return lower as ReviewItemKind;
  }
  if (lower === 'unsupported' || lower === 'unsupported_claim' || lower.includes('unsupported')) {
    return 'unsupported_claim';
  }
  if (lower === 'contradiction' || lower.includes('conflict') || lower.includes('mismatch')) {
    return 'contradiction';
  }
  if (lower === 'risk' || lower === 'warning' || lower === 'critical' || lower === 'hazard') {
    return 'risk';
  }
  if (lower === 'supported' || lower === 'verified' || lower === 'valid') {
    return 'supported';
  }
  return 'note';
}

function sanitizeSummaryFromObject(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      parts.push(`${k}: ${v}`);
    }
  }
  if (parts.length > 0) {
    return parts.join('; ');
  }
  return 'Note recorded by reviewer.';
}

export function normalizeReviewItem(item: unknown): ReviewItem {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    let kind: ReviewItemKind = 'note';
    let issue = trimmed;

    const kindMatch = trimmed.match(/^\[(supported|unsupported_claim|unsupported|risk|contradiction|note)\]\s*(.*)$/i);
    if (kindMatch) {
      kind = normalizeKind(kindMatch[1]);
      issue = kindMatch[2] || trimmed;
    }
    return { kind, issue };
  }

  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const kind = normalizeKind(obj.kind || obj.type || obj.category || obj.status);

    const rawIssue =
      obj.issue ||
      obj.detail ||
      obj.description ||
      obj.observation ||
      obj.message ||
      (obj.title ? `${obj.title}: ${obj.description || ''}` : undefined);

    const issue =
      rawIssue && typeof rawIssue === 'string' && rawIssue.trim().length > 0
        ? rawIssue.trim()
        : sanitizeSummaryFromObject(obj);

    const evidence =
      obj.evidence && typeof obj.evidence === 'string' && obj.evidence.trim().length > 0
        ? obj.evidence.trim()
        : undefined;

    let actionRef: number | undefined;
    const rawActionRef = obj.actionRef ?? obj.action_ref ?? obj.actionIndex ?? obj.action;
    if (typeof rawActionRef === 'number' && Number.isInteger(rawActionRef)) {
      actionRef = rawActionRef;
    } else if (typeof rawActionRef === 'string' && /^\d+$/.test(rawActionRef.trim())) {
      actionRef = parseInt(rawActionRef.trim(), 10);
    }

    let findingRef: string | undefined;
    const rawFindingRef = obj.findingRef ?? obj.finding_ref ?? obj.findingId ?? obj.finding;
    if (typeof rawFindingRef === 'string' && rawFindingRef.trim().length > 0) {
      findingRef = rawFindingRef.trim();
    }

    let claimRef: string | undefined;
    const rawClaimRef = obj.claimRef ?? obj.claim_ref ?? obj.claimId ?? obj.claim;
    if (typeof rawClaimRef === 'string' && rawClaimRef.trim().length > 0) {
      claimRef = rawClaimRef.trim();
    }

    return {
      kind,
      issue,
      evidence,
      actionRef,
      findingRef,
      claimRef,
    };
  }

  return {
    kind: 'note',
    issue: String(item),
  };
}

