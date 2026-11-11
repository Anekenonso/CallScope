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
  eventSource?: string;
}

export interface DecodedArg {
  name: string;
  type: string;
  value: string;
  formattedValue?: string;
  rawAmount?: string;
  decimals?: number;
  symbol?: string;
  decimalsUnavailable?: boolean;
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
  tokenDecimals?: number;
  tokenSymbol?: string;
  formattedAmount?: string;
  decimalsUnavailable?: boolean;
  isSafeWrapper?: boolean;
  isNativeTransfer?: boolean;
  limitations?: string[];
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

export type AnalysisStage =
  | 'input_validation'
  | 'network_verification'
  | 'governor_validation'
  | 'event_lookup'
  | 'action_decoding'
  | 'role_resolution'
  | 'consistency_check'
  | 'assessment'
  | 'sponsor_review';

export interface StageTaggedError {
  stage: AnalysisStage;
  via?: 'blockscout' | 'rpc';
  reason?: 'timeout' | 'range_rejected' | 'rate_limited' | 'not_found' | 'network_error' | 'validation_error' | 'execution_error';
  detail?: string;
}

export interface AnalysisRequest {
  network: SupportedNetwork;
  governorAddress?: string;
  proposalId?: string;
  txHashOrUrl?: string;
  reverifyLive?: boolean;
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
  stageTagged?: StageTaggedError;
}

