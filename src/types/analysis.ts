export type SupportedNetwork = 'ethereum' | 'base';

export type AssessmentOutcome =
  | 'review_recommended'
  | 'no_significant_issue_detected'
  | 'analysis_incomplete';

export interface ProposalInfo {
  id: string;
  title?: string;
  description: string;
  status: string;
  proposer?: string;
  creationTransaction?: string;
  blockNumber?: string;
}

export interface DecodedArg {
  name: string;
  type: string;
  value: string;
}

export interface ProposalAction {
  index: number;
  target: string;
  value: string;
  signature: string;
  selector: string;
  decoded: boolean;
  functionName?: string;
  args?: DecodedArg[];
  rawCalldata: string;
  targetName?: string;
  isProxy?: boolean;
  implementation?: string;
  decodeError?: string;
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  actionIndex?: number;
  target?: string;
  verified: boolean;
  whyItMatters: string;
}

export interface DescriptionConsistency {
  status: 'consistent' | 'inconsistent' | 'indeterminate';
  explanation: string;
  omissions?: string[];
  discrepancies?: string[];
}

export interface ProviderReview {
  status: 'available' | 'unavailable' | 'error' | 'not_configured';
  summary?: string;
  findings?: string[];
  error?: string;
}

export interface EvidenceItem {
  label: string;
  url?: string;
  description?: string;
}

export interface AnalysisRequest {
  network: SupportedNetwork;
  governorAddress: string;
  proposalId: string;
  creationTxHash?: string;
}

export interface AnalysisResponse {
  assessment: AssessmentOutcome;
  network: SupportedNetwork;
  governorAddress: string;
  proposal: ProposalInfo;
  actions: ProposalAction[];
  findings: Finding[];
  descriptionConsistency: DescriptionConsistency;
  reviews: {
    serv: ProviderReview;
    dolphin: ProviderReview;
  };
  limitations: string[];
  evidence: EvidenceItem[];
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

