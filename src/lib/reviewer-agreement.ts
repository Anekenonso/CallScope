import type { AssessmentOutcome, ProviderReview } from '../types/analysis';

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
  dolphin: ProviderReview | undefined
): ReviewerAgreement {
  const stances: ReviewerStance[] = [];

  // 1. Engine stance
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

  // 2. SERV stance
  let servVerdict: 'flagged' | 'clear' | 'unavailable' | 'pending' = 'unavailable';
  let servLabel = 'Not configured';

  if (!serv || serv.status === 'pending') {
    servVerdict = 'pending';
    servLabel = 'Pending analysis...';
  } else if (serv.status === 'not_configured') {
    servVerdict = 'unavailable';
    servLabel = 'Not configured';
  } else if (serv.status === 'error' || serv.status === 'unavailable') {
    servVerdict = 'unavailable';
    servLabel = 'Review unavailable';
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

  // 3. Dolphin stance
  let dolphinVerdict: 'flagged' | 'clear' | 'unavailable' | 'pending' = 'unavailable';
  let dolphinLabel = 'Not configured';

  if (!dolphin || dolphin.status === 'pending') {
    dolphinVerdict = 'pending';
    dolphinLabel = 'Pending analysis...';
  } else if (dolphin.status === 'not_configured') {
    dolphinVerdict = 'unavailable';
    dolphinLabel = 'Not configured';
  } else if (dolphin.status === 'error' || dolphin.status === 'unavailable') {
    dolphinVerdict = 'unavailable';
    dolphinLabel = 'Review unavailable';
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
