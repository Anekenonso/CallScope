import type { VercelRequest, VercelResponse } from '../src/types/vercel';
import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse, EvidenceItem, ProviderReview } from '../src/types/analysis';
import { createChainClient, verifyNetworkChainId, validateGovernorContract } from '../server/chain/rpc-client';
import { retrieveProposalCreatedEvent, readGovernorProposalState } from '../server/chain/proposal-events';
import { decodeProposalActions } from '../server/analysis/decode-actions';
import { detectFindings } from '../server/analysis/detect-findings';
import { checkDescriptionActionConsistency } from '../server/analysis/check-consistency';
import { buildAssessment } from '../server/analysis/build-assessment';
import { reviewWithServ } from '../server/providers/serv';
import { reviewWithDolphin } from '../server/providers/dolphin';
import { SUPPORTED_NETWORKS } from '../server/chain/networks';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Core analysis engine pipeline that executes end-to-end analysis on a proposal
 */
export async function executeAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const { network, governorAddress, proposalId } = request;

  if (!network || (network !== 'ethereum' && network !== 'base')) {
    throw new ValidationError('Invalid network: must be either "ethereum" or "base".');
  }

  if (!governorAddress || !/^0x[a-fA-F0-9]{40}$/.test(governorAddress)) {
    throw new ValidationError('Invalid Governor address: must be a valid 20-byte EVM hex address.');
  }

  if (!proposalId || !/^\d+$/.test(proposalId.trim())) {
    throw new ValidationError('Invalid proposal ID: must be a valid non-empty decimal string.');
  }

  const trimmedProposalId = proposalId.trim();

  // 1. Create client and verify network
  const client = createChainClient(network);
  await verifyNetworkChainId(network, client);

  // 2. Validate Governor contract
  const validGovernor = await validateGovernorContract(client, governorAddress, network);

  // 3. Retrieve ProposalCreated event
  const event = await retrieveProposalCreatedEvent(client, network, validGovernor, trimmedProposalId);

  // 4. Read current proposal state
  const state = await readGovernorProposalState(client, validGovernor, trimmedProposalId);

  // 5. Decode proposal actions
  const { actions, limitations } = await decodeProposalActions({
    network,
    targets: event.targets,
    values: event.values,
    signatures: event.signatures,
    calldatas: event.calldatas,
    client,
  });

  // 6. Run deterministic security checks
  const findings = detectFindings(actions);

  // 7. Check consistency between proposal description and executable actions
  const descriptionConsistency = checkDescriptionActionConsistency(event.description, actions);

  // 8. Build final deterministic assessment
  const assessment = buildAssessment({
    actions,
    findings,
    consistency: descriptionConsistency,
    limitations,
  });

  // 9. Run sponsor advisory reviews concurrently (bounded, non-blocking)
  const [servResult, dolphinResult] = await Promise.allSettled([
    reviewWithServ(event.description, actions),
    reviewWithDolphin(event.description, actions, findings),
  ]);

  const servReview: ProviderReview =
    servResult.status === 'fulfilled'
      ? servResult.value
      : { status: 'error', error: servResult.reason?.message || 'SERV review failed' };

  const dolphinReview: ProviderReview =
    dolphinResult.status === 'fulfilled'
      ? dolphinResult.value
      : { status: 'error', error: dolphinResult.reason?.message || 'Dolphin review failed' };

  // Evidence links
  const networkConfig = SUPPORTED_NETWORKS[network];
  const evidence: EvidenceItem[] = [
    {
      label: 'Governor Contract',
      url: `${networkConfig.explorerUrl}/address/${validGovernor}`,
      description: `Verified on-chain governor at ${validGovernor}`,
    },
    {
      label: 'Proposal Creation Transaction',
      url: `${networkConfig.explorerUrl}/tx/${event.transactionHash}`,
      description: `Emitted ProposalCreated event in block ${event.blockNumber.toString()}`,
    },
  ];

  for (let i = 0; i < actions.length; i++) {
    const act = actions[i]!;
    evidence.push({
      label: `Action #${i + 1} Target: ${act.targetName || act.target.slice(0, 10) + '...'}`,
      url: `${networkConfig.explorerUrl}/address/${act.target}`,
      description: act.isProxy && act.implementation
        ? `Proxy contract pointing to implementation ${act.implementation}`
        : `Direct target contract`,
    });
  }

  return {
    assessment,
    network,
    governorAddress: validGovernor,
    proposal: {
      id: trimmedProposalId,
      description: event.description,
      status: state,
      proposer: event.proposer,
      creationTransaction: event.transactionHash,
      blockNumber: event.blockNumber.toString(),
    },
    actions,
    findings,
    descriptionConsistency,
    reviews: {
      serv: servReview,
      dolphin: dolphinReview,
    },
    limitations,
    evidence,
  };
}

async function handleWebRequest(request: Request): Promise<Response> {
  // Enforce POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method Not Allowed',
        details: 'Only POST requests are supported.',
      } satisfies ApiErrorResponse),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          Allow: 'POST',
        },
      }
    );
  }

  // Rate limiting check
  const forwarded = request.headers.get('x-forwarded-for');
  const clientIp = forwarded?.split(',')[0]?.trim() || '127.0.0.1';

  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        details: 'Rate limit exceeded. Please wait before submitting additional proposals.',
      } satisfies ApiErrorResponse),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Read payload text
  let bodyText = '';
  try {
    bodyText = await request.text();
  } catch {
    bodyText = '';
  }

  // Enforce payload size limit (max 64KB)
  if (bodyText.length > 65_536) {
    return new Response(
      JSON.stringify({
        error: 'Payload Too Large',
        details: 'Request body exceeds maximum allowed size (64KB).',
      } satisfies ApiErrorResponse),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let body: AnalysisRequest;
  try {
    body = JSON.parse(bodyText || '{}') as AnalysisRequest;
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Invalid JSON',
        details: 'Request body is not valid JSON.',
      } satisfies ApiErrorResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const response = await executeAnalysis(body);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      const errorTitle = err.message.split(':')[0] || 'Bad Request';
      return new Response(
        JSON.stringify({
          error: errorTitle,
          details: err.message,
        } satisfies ApiErrorResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    const rawMessage = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(
      JSON.stringify({
        error: 'Analysis Error',
        details: sanitizePublicErrorMessage(rawMessage),
      } satisfies ApiErrorResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleNodeReqRes(req: VercelRequest, res: VercelResponse) {
  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: 'Method Not Allowed',
      details: 'Only POST requests are supported.',
    } satisfies ApiErrorResponse);
  }

  try {
    const body = (req.body || {}) as Partial<AnalysisRequest>;
    const response = await executeAnalysis(body as AnalysisRequest);
    return res.status(200).json(response);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      const errorTitle = err.message.split(':')[0] || 'Bad Request';
      return res.status(400).json({
        error: errorTitle,
        details: err.message,
      } satisfies ApiErrorResponse);
    }
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({
      error: 'Analysis Error',
      details: message,
    } satisfies ApiErrorResponse);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleWebRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleWebRequest(request);
}

export default async function handler(
  req: VercelRequest | Request,
  res?: VercelResponse
) {
  if (
    !res ||
    typeof (res as any).status !== 'function' ||
    (typeof Request !== 'undefined' && req instanceof Request) ||
    typeof (req as any).json === 'function'
  ) {
    return handleWebRequest(req as Request);
  }
  return handleNodeReqRes(req as VercelRequest, res as VercelResponse);
}
