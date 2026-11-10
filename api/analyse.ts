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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: 'Method Not Allowed',
      details: 'Only POST requests are supported.',
    } satisfies ApiErrorResponse);
  }

  try {
    const { network, governorAddress, proposalId } = (req.body || {}) as Partial<AnalysisRequest>;

    if (!network || (network !== 'ethereum' && network !== 'base')) {
      return res.status(400).json({
        error: 'Invalid network',
        details: 'Network must be either "ethereum" or "base".',
      } satisfies ApiErrorResponse);
    }

    if (!governorAddress || !/^0x[a-fA-F0-9]{40}$/.test(governorAddress)) {
      return res.status(400).json({
        error: 'Invalid Governor address',
        details: 'Governor address must be a valid 20-byte EVM hex address.',
      } satisfies ApiErrorResponse);
    }

    if (!proposalId || !/^\d+$/.test(proposalId.trim())) {
      return res.status(400).json({
        error: 'Invalid proposal ID',
        details: 'Proposal ID must be a valid non-empty decimal string.',
      } satisfies ApiErrorResponse);
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

    const response: AnalysisResponse = {
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

    return res.status(200).json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({
      error: 'Analysis Error',
      details: message,
    } satisfies ApiErrorResponse);
  }
}
