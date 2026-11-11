import { describe, it, expect } from 'vitest';
import {
  evaluateClaimsLedger,
  extractFallbackClaims,
  extractClaimsWithServ,
  parseUnitsExact,
  getActionRecipient,
} from '../../server/analysis/claims-ledger';
import { checkDescriptionActionConsistency } from '../../server/analysis/check-consistency';
import type { Claim, ProposalAction } from '../../src/types/analysis';

describe('Claims Ledger & Consistency Engine', () => {
  const ensDescription = `# [Executable] Establishing a new Security Council
## Abstract
This proposal establishes the new ENS Security Council based on the results of EP 6.50 “Election of the New ENS DAO Security Council”. The term will last two years, until 16 July 2028.

## Motivation
The Security Council was originally established in EP 5.13 as a 4-of-8 multisig with a single power: to cancel malicious proposals made to ENS DAO. It cannot propose, amend, or initiate any governance action. Its term was two years, ending 24 July 2026.

The purpose of this proposal is to establish a new Security Council that will inherit the same responsibilities for the coming two years.

## Specification
A single call to the DAO’s TimelockController, granting \`PROPOSER_ROLE\` to Blockful’s Security Council contract, which is owned by a multisig with the Security Council members elected in EP 6.50.

The Security Council contract has been deployed to \`0x2acBf518b3759f6e1fA163294eda55bF1d0ae051\`, and the multisig to \`0x7101B78638e34444F0a5AdE9e1149fbEeC029931\`.

After two years, any address may call \`renounceTimelockRoleByExpiration()\` to revoke its cancel power unless \`extend()\` is called first by a separate DAO proposal.`;

  const ensAction: ProposalAction = {
    index: 0,
    target: '0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7',
    value: '0',
    signature: 'grantRole(bytes32,address)',
    selector: '0x2f2ff15d',
    decoded: true,
    functionName: 'grantRole',
    roleCapability: {
      status: 'resolved',
      capabilities: [
        { fn: 'schedule', gatedBy: 'PROPOSER_ROLE' },
        { fn: 'scheduleBatch', gatedBy: 'PROPOSER_ROLE' },
        { fn: 'cancel', gatedBy: 'PROPOSER_ROLE' },
      ],
      summary: 'can schedule and cancel on TimelockController (per verified source)',
      sourceOrigin: 'verified_source',
    },
    args: [
      {
        name: 'role',
        type: 'bytes32',
        value: '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1',
      },
      {
        name: 'account',
        type: 'address',
        value: '0x2acbf518b3759f6e1fa163294eda55bf1d0ae051',
      },
    ],
    rawCalldata:
      '0x2f2ff15db09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc10000000000000000000000002acbf518b3759f6e1fa163294eda55bf1d0ae051',
    targetName: 'TimelockController',
  };

  const unlockDescription = `# DAO Constant Payment Roll October
The next proposal is to make the payment for the months of September:
David Moderator: 400 USDC to 0xca7632327567796e51920f6b16373e92c7823854`;

  const unlockAction: ProposalAction = {
    index: 0,
    target: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    value: '0',
    signature: 'transfer(address,uint256)',
    selector: '0xa9059cbb',
    decoded: true,
    functionName: 'transfer',
    tokenDecimals: 6,
    tokenSymbol: 'USDC',
    formattedAmount: '400 USDC',
    args: [
      { name: 'to', type: 'address', value: '0xca7632327567796e51920f6b16373e92c7823854' },
      { name: 'amount', type: 'uint256', value: '400000000' }, // 400 USDC (6 decimals)
    ],
    rawCalldata: '0xa9059cbb...',
  };

  describe('Verbatim Substring Guard', () => {
    it('discards hallucinated claims whose quote is not an exact substring of the description', () => {
      const claims: Claim[] = [
        {
          id: 'claim-1',
          quote: 'This sentence was hallucinated by an LLM and does not exist in the proposal.',
          category: 'role',
        },
        {
          id: 'claim-2',
          quote: 'The term will last two years, until 16 July 2028.',
          category: 'duration',
        },
      ];

      const result = evaluateClaimsLedger(claims, [ensAction], ensDescription);
      expect(result.claims).toHaveLength(1);
      expect(result.claims?.[0]?.quote).toBe('The term will last two years, until 16 July 2028.');
    });
  });

  describe('ENS Fixture Contradiction', () => {
    it('detects contradiction between "cannot propose" and action granting PROPOSER_ROLE', () => {
      const claims: Claim[] = [
        {
          id: 'claim-1',
          quote: 'It cannot propose, amend, or initiate any governance action.',
          category: 'capability',
        },
      ];

      const result = evaluateClaimsLedger(claims, [ensAction], ensDescription);
      expect(result.status).toBe('inconsistent');
      expect(result.claims?.[0]?.status).toBe('contradicted');
      expect(result.claims?.[0]?.explanation).toContain('Contradiction');
      expect(result.claims?.[0]?.explanation).toContain('PROPOSER_ROLE');
      expect(result.discrepancies?.[0]?.toLowerCase()).toContain('contradict');
    });
  });

  describe('Unlock Fixture Transfers', () => {
    it('verifies recipient and amount claims against transfer calldata', () => {
      const claims: Claim[] = [
        {
          id: 'claim-1',
          quote: '400 USDC',
          category: 'amount',
        },
        {
          id: 'claim-2',
          quote: '0xca7632327567796e51920f6b16373e92c7823854',
          category: 'recipient',
        },
      ];

      const result = evaluateClaimsLedger(claims, [unlockAction], unlockDescription);
      expect(result.status).toBe('consistent');
      expect(result.claims?.[0]?.status).toBe('verified');
      expect(result.claims?.[1]?.status).toBe('verified');
    });
  });

  describe('Sensitive Action Coverage Rule', () => {
    it('returns partially_verified if sensitive action is executed without covering claim', () => {
      // Sensitive grantRole action is present, but only an unrelated amount claim exists
      const claims: Claim[] = [
        {
          id: 'claim-1',
          quote: 'The term will last two years, until 16 July 2028.',
          category: 'duration',
        },
      ];

      const result = evaluateClaimsLedger(claims, [ensAction], ensDescription);
      // Duration is not_checkable, sensitive grantRole action is uncovered -> indeterminate or partially_verified
      expect(result.status).not.toBe('consistent');
      expect(result.status).toBe('indeterminate');
    });

    it('returns partially_verified if some claims are verified but non-sensitive action is not covered or off-chain claims remain', () => {
      const claims: Claim[] = [
        {
          id: 'claim-1',
          quote: '400 USDC',
          category: 'amount',
        },
        {
          id: 'claim-2',
          quote: 'The next proposal is to make the payment for the months of September:',
          category: 'duration',
        },
      ];

      const result = evaluateClaimsLedger(claims, [unlockAction], unlockDescription);
      expect(result.status).toBe('partially_verified');
      expect(result.claims?.find((c) => c.category === 'amount')?.status).toBe('verified');
      expect(result.claims?.find((c) => c.category === 'duration')?.status).toBe('not_checkable');
    });
  });

  describe('Fallback Mode & Truthful Labeling', () => {
    it('labels keyword check correctly and avoids "intended effects" phrasing', () => {
      const result = checkDescriptionActionConsistency(unlockDescription, [unlockAction]);
      expect(result.status).toBe('consistent');
      expect(result.mode).toBe('keyword_fallback');
      expect(result.explanation).toContain('Keyword check only. Claims were not individually verified.');
      expect(result.explanation).not.toContain('intended effects');
    });

    it('extracts heuristic claims in fallback mode with verbatim substrings', () => {
      const claims = extractFallbackClaims(ensDescription);
      expect(claims.length).toBeGreaterThanOrEqual(1);
      for (const c of claims) {
        expect(ensDescription).toContain(c.quote);
      }
    });

    it('returns null gracefully when SERV is unconfigured', async () => {
      const savedKey = process.env.SERV_API_KEY;
      delete process.env.SERV_API_KEY;
      try {
        const claims = await extractClaimsWithServ(ensDescription);
        expect(claims).toBeNull();
      } finally {
        if (savedKey) process.env.SERV_API_KEY = savedKey;
      }
    });
  });

  describe('Strict Claims Ledger Comparators & False-Positive Traps (Task 3)', () => {
    it('parses decimal amounts without floating point loss via parseUnitsExact', () => {
      expect(parseUnitsExact('400.00', 6)).toBe(400000000n);
      expect(parseUnitsExact('1,000.5', 18)).toBe(1000500000000000000000n);
      expect(parseUnitsExact('0.000001', 6)).toBe(1n);
      expect(parseUnitsExact('0.0000001', 6)).toBeNull(); // Exceeds 6 decimals
      expect(parseUnitsExact('invalid', 6)).toBeNull();
    });

    it('rejects "right amount wrong token" false positive (e.g. 400 DAI claimed vs 400 USDC action)', () => {
      const claim: Claim = {
        id: 'claim-dai',
        quote: '400 DAI',
        category: 'amount',
      };
      const desc = 'Grant of 400 DAI to team';
      const result = evaluateClaimsLedger([claim], [unlockAction], desc);
      expect(result.claims?.[0]?.status).toBe('not_checkable');
      expect(result.claims?.[0]?.explanation).toContain('USDC');
    });

    it('marks amount not_checkable if proposal contains multiple tokens and claim does not name the token', () => {
      const claim: Claim = {
        id: 'claim-ambiguous',
        quote: '400',
        category: 'amount',
      };
      const desc = 'Transfer 400 to recipient';
      const ethAction: ProposalAction = {
        index: 1,
        target: '0x1111111111111111111111111111111111111111',
        value: '10000000000000000000', // 10 ETH
        signature: '',
        selector: '0x',
        decoded: false,
        rawCalldata: '0x',
        isNativeTransfer: true,
        tokenSymbol: 'ETH',
        tokenDecimals: 18,
      };

      const result = evaluateClaimsLedger([claim], [unlockAction, ethAction], desc);
      expect(result.claims?.[0]?.status).toBe('not_checkable');
      expect(result.claims?.[0]?.explanation).toContain('multiple tokens');
    });

    it('identifies recipient strictly per ABI: transferFrom recipient is "to", NEVER "from" or spender', () => {
      const transferFromAction: ProposalAction = {
        index: 0,
        target: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC contract (target)
        value: '0',
        signature: 'transferFrom(address,address,uint256)',
        selector: '0x23b872dd',
        decoded: true,
        functionName: 'transferFrom',
        args: [
          { name: 'from', type: 'address', value: '0x1111111111111111111111111111111111111111' },
          { name: 'to', type: 'address', value: '0x2222222222222222222222222222222222222222' },
          { name: 'amount', type: 'uint256', value: '100000000' },
        ],
        rawCalldata: '0x23b872dd...',
      };

      const recipientInfo = getActionRecipient(transferFromAction);
      expect(recipientInfo).not.toBeNull();
      expect(recipientInfo?.recipient.toLowerCase()).toBe('0x2222222222222222222222222222222222222222');
      expect(recipientInfo?.recipient.toLowerCase()).not.toBe('0x1111111111111111111111111111111111111111');
      expect(recipientInfo?.recipient.toLowerCase()).not.toBe('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');

      // Claim asserting 0x11111111... is recipient fails
      const fromClaim: Claim = {
        id: 'c1',
        quote: '0x1111111111111111111111111111111111111111',
        category: 'recipient',
      };
      const desc = 'Send funds to 0x1111111111111111111111111111111111111111 and 0x2222222222222222222222222222222222222222';
      const resultFrom = evaluateClaimsLedger([fromClaim], [transferFromAction], desc);
      expect(resultFrom.claims?.[0]?.status).toBe('not_checkable');

      // Claim asserting 0x22222222... is recipient succeeds
      const toClaim: Claim = {
        id: 'c2',
        quote: '0x2222222222222222222222222222222222222222',
        category: 'recipient',
      };
      const resultTo = evaluateClaimsLedger([toClaim], [transferFromAction], desc);
      expect(resultTo.claims?.[0]?.status).toBe('verified');
      expect(resultTo.claims?.[0]?.evidenceRef?.argName).toBe('to');
    });

    it('never matches the token contract target itself as a recipient', () => {
      const usdcContractClaim: Claim = {
        id: 'c-token',
        quote: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        category: 'recipient',
      };
      const desc = 'USDC contract at 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const result = evaluateClaimsLedger([usdcContractClaim], [unlockAction], desc);
      expect(result.claims?.[0]?.status).toBe('not_checkable');
    });

    it('detects contradiction when role is granted to a different address than claimed', () => {
      const wrongAccountClaim: Claim = {
        id: 'c-wrong-acc',
        quote: 'granting PROPOSER_ROLE to 0x000000000000000000000000000000000000dEaD',
        category: 'role',
        params: {
          role: 'PROPOSER_ROLE',
          account: '0x000000000000000000000000000000000000dEaD',
        },
      };
      const desc = 'Proposal specification: granting PROPOSER_ROLE to 0x000000000000000000000000000000000000dEaD';
      const result = evaluateClaimsLedger([wrongAccountClaim], [ensAction], desc);
      expect(result.status).toBe('inconsistent');
      expect(result.claims?.[0]?.status).toBe('contradicted');
      expect(result.claims?.[0]?.explanation).toContain('Contradiction');
      expect(result.claims?.[0]?.explanation).toContain('0x2acbf518b3759f6e1fa163294eda55bf1d0ae051');
    });

    it('evaluates capability claim as not_checkable when role capability is unresolved (never false contradicted or verified)', () => {
      const unresolvedAction: ProposalAction = {
        ...ensAction,
        roleCapability: {
          status: 'unresolved',
          sourceOrigin: 'unresolved',
          summary: 'Verified source code unavailable or unparseable.',
        },
      };

      const capabilityClaim: Claim = {
        id: 'c-cap',
        quote: 'It cannot propose, amend, or initiate any governance action.',
        category: 'capability',
      };

      const result = evaluateClaimsLedger([capabilityClaim], [unresolvedAction], ensDescription);
      expect(result.claims?.[0]?.status).toBe('not_checkable');
      expect(result.claims?.[0]?.explanation).toContain('unresolved');
      expect(result.status).not.toBe('inconsistent');
    });
  });
});
