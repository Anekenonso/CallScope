import type { AssessmentOutcome, ProviderReview, DescriptionConsistency } from '../types/analysis';

export interface ReviewerStance {
  name: 'Deterministic Engine' | 'OpenServ SERV' | 'Dolphin';
  verdict: 'flagged' | 'clear' | 'unavailable' | 'pending';
  label: string;
  details?: string;
}

export interface ReviewerAgreement {
  status: 'agree' | 'disagree' | 'pending' | 'single_available';
  headline: string;
  stances: ReviewerStance[];
}

export function computeReviewerAgreement(
  assessment: AssessmentOutcome | undefined,
  serv: ProviderReview | undefined,
  dolphin: ProviderReview | undefined,
  extendedConsistency?: DescriptionConsistency
): ReviewerAgreement {
  const stances: ReviewerStance[] = [];

  // 1. Engine stance (Authoritative deterministic baseline)
  let engineVerdict: 'flagged' | 'clear' | 'pending' = 'clear';
  let engineLabel = 'No significant issues detected';

  if (!assessment) {
    engineVerdict = 'pending';
    engineLabel = 'Pending';
  } else if (assessment === 'review_recommended') {
    engineVerdict = 'flagged';
    engineLabel = 'Review recommended (flags present)';
  } else if (assessment === 'analysis_incomplete') {
    engineVerdict = 'flagged';
    engineLabel = 'Limitations / incomplete analysis';
  } else {
    engineVerdict = 'clear';
    engineLabel = 'No significant issues detected';
  }

  stances.push({
    name: 'Deterministic Engine',
    verdict: engineVerdict,
    label: engineLabel,
  });

  // 2. OpenServ SERV stance (Extended claims check & tool-grounded investigator)
  let servVerdict: 'flagged' | 'clear' | 'unavailable' | 'pending' = 'unavailable';
  let servLabel = 'Not configured';

  if (!serv || serv.status === 'pending') {
    servVerdict = 'pending';
    servLabel = 'Pending analysis...';
  } else if (serv.status === 'not_configured') {
    servVerdict = 'unavailable';
    servLabel = 'Not configured';
  } else if (serv.status === 'rate_limited') {
    servVerdict = 'unavailable';
    servLabel = 'Rate limited';
  } else if (serv.status === 'timed_out') {
    servVerdict = 'unavailable';
    servLabel = 'Timed out';
  } else if (serv.status === 'auth_error') {
    servVerdict = 'unavailable';
    servLabel = 'Auth error';
  } else if (serv.status === 'guard_blocked') {
    servVerdict = 'flagged';
    servLabel = 'Guard blocked: injection attempt detected';
  } else if (serv.status === 'schema_invalid') {
    servVerdict = 'unavailable';
    servLabel = 'Schema invalid';
  } else if (serv.status === 'upstream_error' || serv.status === 'error' || serv.status === 'unavailable') {
    servVerdict = 'unavailable';
    servLabel = 'Review unavailable';
  } else if (extendedConsistency && extendedConsistency.status) {
    if (extendedConsistency.status === 'inconsistent') {
      servVerdict = 'flagged';
      servLabel = 'Contradiction detected in claims ledger';
    } else if (extendedConsistency.status === 'partially_verified') {
      servVerdict = 'flagged';
      servLabel = 'Partially verified / off-chain claims';
    } else if (extendedConsistency.status === 'consistent') {
      servVerdict = 'clear';
      servLabel = 'All verified claims match actions';
    } else {
      servVerdict = 'clear';
      servLabel = 'Extended claims check indeterminate';
    }
  } else {
    const hasFlags = (serv.items || []).some(
      (item) => item.kind === 'contradiction' || item.kind === 'unsupported_claim' || item.kind === 'risk'
    );
    if (hasFlags) {
      servVerdict = 'flagged';
      servLabel = 'Identified contradictions / unsupported claims';
    } else {
      servVerdict = 'clear';
      servLabel = 'No contradictions detected';
    }
  }

  stances.push({
    name: 'OpenServ SERV',
    verdict: servVerdict,
    label: servLabel,
  });

  // 3. Dolphin stance (Adversarial attack scenarios & rebuttal loop)
  let dolphinVerdict: 'flagged' | 'clear' | 'unavailable' | 'pending' = 'unavailable';
  let dolphinLabel = 'Not configured';

  if (!dolphin || dolphin.status === 'pending') {
    dolphinVerdict = 'pending';
    dolphinLabel = 'Pending analysis...';
  } else if (dolphin.status === 'not_configured') {
    dolphinVerdict = 'unavailable';
    dolphinLabel = 'Not configured';
  } else if (dolphin.status === 'rate_limited') {
    dolphinVerdict = 'unavailable';
    dolphinLabel = 'Rate limited';
  } else if (dolphin.status === 'timed_out') {
    dolphinVerdict = 'unavailable';
    dolphinLabel = 'Timed out';
  } else if (dolphin.status === 'auth_error') {
    dolphinVerdict = 'unavailable';
    dolphinLabel = 'Auth error';
  } else if (dolphin.status === 'guard_blocked') {
    dolphinVerdict = 'flagged';
    dolphinLabel = 'Guard blocked: injection attempt detected';
  } else if (dolphin.status === 'schema_invalid') {
    dolphinVerdict = 'unavailable';
    dolphinLabel = 'Schema invalid';
  } else if (dolphin.status === 'upstream_error' || dolphin.status === 'error' || dolphin.status === 'unavailable') {
    dolphinVerdict = 'unavailable';
    dolphinLabel = 'Review unavailable';
  } else if (dolphin.scenarios && dolphin.scenarios.length > 0) {
    const unrefuted = dolphin.scenarios.filter((s) => s.rebuttalStatus === 'not_refuted');
    const needsHuman = dolphin.scenarios.filter((s) => s.rebuttalStatus === 'needs_human');

    if (unrefuted.length > 0) {
      dolphinVerdict = 'flagged';
      dolphinLabel = `${unrefuted.length} unrefuted attack scenario(s)`;
    } else if (needsHuman.length > 0) {
      dolphinVerdict = 'flagged';
      dolphinLabel = `${needsHuman.length} scenario(s) require delegate review`;
    } else {
      dolphinVerdict = 'clear';
      dolphinLabel = 'All proposed scenarios refuted by engine facts';
    }
  } else {
    const hasFlags = (dolphin.items || []).some(
      (item) => item.kind === 'risk' || item.kind === 'contradiction' || item.kind === 'unsupported_claim'
    );
    if (hasFlags) {
      dolphinVerdict = 'flagged';
      dolphinLabel = 'Identified security or logic risks';
    } else {
      dolphinVerdict = 'clear';
      dolphinLabel = 'No risks flagged';
    }
  }

  stances.push({
    name: 'Dolphin',
    verdict: dolphinVerdict,
    label: dolphinLabel,
  });

  // Check pending
  if (servVerdict === 'pending' || dolphinVerdict === 'pending') {
    return {
      status: 'pending',
      headline: 'Reviewer comparison pending...',
      stances,
    };
  }

  // Filter available reviewers (Engine + configured/available sponsors)
  const activeVerdicts = stances
    .filter((s) => s.verdict === 'flagged' || s.verdict === 'clear')
    .map((s) => s.verdict);

  if (activeVerdicts.length <= 1) {
    return {
      status: 'single_available',
      headline: 'Deterministic engine authoritative (sponsor reviews unavailable)',
      stances,
    };
  }

  const allAgree = activeVerdicts.every((v) => v === activeVerdicts[0]);

  if (allAgree) {
    return {
      status: 'agree',
      headline: 'Reviewers agree',
      stances,
    };
  } else {
    return {
      status: 'disagree',
      headline: 'Reviewers disagree: human review needed',
      stances,
    };
  }
}

