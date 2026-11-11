import { describe, it, expect } from 'vitest';
import { decodeProposalActions } from '../../server/analysis/decode-actions';
import { detectFindings } from '../../server/analysis/detect-findings';
import { checkDescriptionActionConsistency } from '../../server/analysis/check-consistency';
import { buildAssessment } from '../../server/analysis/build-assessment';
import { formatTokenAmount, resolveTokenMetadata } from '../../server/analysis/token-metadata';
import type { ProposalAction } from '../../src/types/analysis';

describe('Final Reliability Gap Fixes — 7-Area Regression Suite', () => {
  const dummyGovernor = '0x1111111111111111111111111111111111111111' as const;
  const recipientAlice = '0x2222222222222222222222222222222222222222' as const;
  const recipientBob = '0x3333333333333333333333333333333333333333' as const;
  const usdcMainnet = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;
  const ensTokenMainnet = '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72' as const;
  const mockClient = {} as any;

  // Area A: Native ETH transfers (ENS delegation incentives and treasury conversion proposals)
  describe('Area A: Native ETH transfers', () => {
    it('recognises direct native ETH transfer with empty calldata as valid transfer', async () => {
      const result = await decodeProposalActions({
        network: 'ethereum',
        targets: [recipientAlice],
        values: [10500000000000000000n], // 10.5 ETH
        signatures: [''],
        calldatas: ['0x'],
        client: mockClient,
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.decoded).toBe(true);
      expect(action.isNativeTransfer).toBe(true);
      expect(action.functionName).toBe('transfer');
      expect(action.formattedAmount).toBe('10.5 ETH');
      expect(action.tokenSymbol).toBe('ETH');
      expect(action.tokenDecimals).toBe(18);
      expect(action.args).toBeDefined();
      expect(action.args?.[0]?.name).toBe('recipient');
      expect(action.args?.[0]?.value).toBe(recipientAlice);
      expect(action.args?.[1]?.value).toBe('10500000000000000000');
    });

    it('does not classify native ETH transfer as an unknown function or undecoded action in findings', () => {
      const action: ProposalAction = {
        index: 0,
        target: recipientAlice,
        value: '10500000000000000000',
        signature: 'transfer(address,uint256)',
        selector: '0x',
        decoded: true,
        isNativeTransfer: true,
        functionName: 'transfer',
        formattedAmount: '10.5 ETH',
        tokenSymbol: 'ETH',
        tokenDecimals: 18,
        args: [
          { name: 'recipient', type: 'address', value: recipientAlice },
          { name: 'amount', type: 'uint256', value: '10500000000000000000' },
        ],
        rawCalldata: '0x',
      };

      const findings = detectFindings([action]);
      const undecodedFinding = findings.find((f) => f.id.startsWith('UNDECODED_ACTION'));
      expect(undecodedFinding).toBeUndefined();

      const nativeFinding = findings.find((f) => f.id.startsWith('NATIVE_VALUE_TRANSFER'));
      expect(nativeFinding).toBeDefined();
      expect(nativeFinding?.severity).toBe('medium');
      expect(nativeFinding?.description).toContain('10.5 ETH');
      expect(nativeFinding?.verified).toBe(true);
    });

    it('validates description consistency for native ETH allocation', () => {
      const action: ProposalAction = {
        index: 0,
        target: recipientAlice,
        value: '10500000000000000000',
        signature: 'transfer(address,uint256)',
        selector: '0x',
        decoded: true,
        isNativeTransfer: true,
        functionName: 'transfer',
        formattedAmount: '10.5 ETH',
        tokenSymbol: 'ETH',
        tokenDecimals: 18,
        args: [
          { name: 'recipient', type: 'address', value: recipientAlice },
          { name: 'amount', type: 'uint256', value: '10500000000000000000' },
        ],
        rawCalldata: '0x',
      };

      const desc = `Treasury disbursement: transfer of 10.5 ETH to recipient ${recipientAlice} for delegation incentives.`;
      const consistency = checkDescriptionActionConsistency(desc, [action]);
      expect(consistency.status).toBe('consistent');
    });
  });

  // Area B: Token amount accuracy (ENS Contract Naming Season: ENS & USDC decimal formatting)
  describe('Area B: Token amount accuracy & decimal formatting', () => {
    it('accurately converts USDC amounts using 6 decimals', () => {
      const rawUsdcAmount = 100000000000n; // 100,000 USDC with 6 decimals
      const formatted = formatTokenAmount(rawUsdcAmount, 6, 'USDC');
      expect(formatted.formatted).toBe('100000 USDC');
      expect(formatted.decimalsUnavailable).toBe(false);
    });

    it('accurately converts ENS amounts using 18 decimals', () => {
      const rawEnsAmount = 500000000000000000000n; // 500 ENS with 18 decimals
      const formatted = formatTokenAmount(rawEnsAmount, 18, 'ENS');
      expect(formatted.formatted).toBe('500 ENS');
    });

    it('never assumes 18 decimals when decimals cannot be verified and marks formatted amount unavailable', () => {
      const rawUnknownAmount = 500000000000000000000n;
      const formatted = formatTokenAmount(rawUnknownAmount, undefined);
      expect(formatted.formatted).toBeUndefined();
      expect(formatted.decimalsUnavailable).toBe(true);
    });

    it('resolves canonical token metadata for Ethereum Mainnet tokens', async () => {
      const usdcMeta = await resolveTokenMetadata('ethereum', usdcMainnet);
      expect(usdcMeta.decimals).toBe(6);
      expect(usdcMeta.symbol).toBe('USDC');

      const ensMeta = await resolveTokenMetadata('ethereum', ensTokenMainnet);
      expect(ensMeta.decimals).toBe(18);
      expect(ensMeta.symbol).toBe('ENS');
    });
  });

  // Area C: Approval and description consistency (ENS Labs legal-fees / ENSv2 funding proposal)
  describe('Area C: Approval and description consistency', () => {
    it('catches scenario where proposal claims daily USDC stream but only executes unlimited approval', () => {
      const action: ProposalAction = {
        index: 0,
        target: usdcMainnet,
        targetName: 'USDC',
        value: '0',
        signature: 'approve(address,uint256)',
        selector: '0x095ea7b3',
        decoded: true,
        functionName: 'approve',
        args: [
          { name: 'spender', type: 'address', value: recipientBob },
          {
            name: 'amount',
            type: 'uint256',
            value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          },
        ],
        rawCalldata: '0x095ea7b3...',
      };

      const desc = `Establish a daily USDC stream of 10,000 USDC per day to support legal defense fees via streaming.`;
      const consistency = checkDescriptionActionConsistency(desc, [action]);

      expect(consistency.status).toBe('inconsistent');
      expect(consistency.discrepancies?.length).toBeGreaterThan(0);
      const streamDiscrepancy = consistency.discrepancies?.find((d) =>
        d.includes('payment stream') || d.includes('daily stream')
      );
      expect(streamDiscrepancy).toBeDefined();
      expect(streamDiscrepancy).toContain('does not configure or initiate an active stream');
    });

    it('catches scenario where proposal claims direct transfer but only executes an approval', () => {
      const action: ProposalAction = {
        index: 0,
        target: usdcMainnet,
        targetName: 'USDC',
        value: '0',
        signature: 'approve(address,uint256)',
        selector: '0x095ea7b3',
        decoded: true,
        functionName: 'approve',
        args: [
          { name: 'spender', type: 'address', value: recipientBob },
          { name: 'amount', type: 'uint256', value: '50000000000' }, // 50,000 USDC
        ],
        rawCalldata: '0x095ea7b3...',
      };

      const desc = `Transfer 50,000 USDC to development partner for infrastructure support.`;
      const consistency = checkDescriptionActionConsistency(desc, [action]);

      expect(consistency.status).toBe('inconsistent');
      expect(consistency.discrepancies?.some((d) => d.includes('rather than a direct transfer'))).toBe(true);
    });
  });

  // Area D: Material financial actions (ENSv2 and SPP3 proposals)
  describe('Area D: Material financial actions', () => {
    it('surfaces finite token approval as medium severity and explains granted authority', () => {
      const action: ProposalAction = {
        index: 0,
        target: usdcMainnet,
        targetName: 'USDC',
        value: '0',
        signature: 'approve(address,uint256)',
        selector: '0x095ea7b3',
        decoded: true,
        functionName: 'approve',
        formattedAmount: '50000 USDC',
        tokenSymbol: 'USDC',
        tokenDecimals: 6,
        args: [
          { name: 'spender', type: 'address', value: recipientBob },
          { name: 'amount', type: 'uint256', value: '50000000000', formattedValue: '50000 USDC' },
        ],
        rawCalldata: '0x095ea7b3...',
      };

      const findings = detectFindings([action]);
      const materialApproval = findings.find((f) => f.id.startsWith('MATERIAL_TOKEN_APPROVAL'));

      expect(materialApproval).toBeDefined();
      expect(materialApproval?.severity).toBe('medium');
      expect(materialApproval?.title).toContain('material token approval');
      expect(materialApproval?.description).toContain('50000 USDC');
      expect(materialApproval?.description).toContain('transferFrom');
      expect(materialApproval?.whyItMatters).toContain('delegate withdrawal authority');
    });

    it('surfaces unlimited token approval as high severity and explains unbounded withdrawal authority', () => {
      const action: ProposalAction = {
        index: 0,
        target: usdcMainnet,
        targetName: 'USDC',
        value: '0',
        signature: 'approve(address,uint256)',
        selector: '0x095ea7b3',
        decoded: true,
        functionName: 'approve',
        args: [
          { name: 'spender', type: 'address', value: recipientBob },
          {
            name: 'amount',
            type: 'uint256',
            value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          },
        ],
        rawCalldata: '0x095ea7b3...',
      };

      const findings = detectFindings([action]);
      const infiniteApproval = findings.find((f) => f.id.startsWith('INFINITE_TOKEN_APPROVAL'));

      expect(infiniteApproval).toBeDefined();
      expect(infiniteApproval?.severity).toBe('high');
      expect(infiniteApproval?.title).toContain('unlimited token allowance');
      expect(infiniteApproval?.description).toContain('recurring withdrawal authority up to the entire treasury balance');
    });
  });

  // Area E: Safe transaction wrappers (ENS treasury proposals)
  describe('Area E: Safe transaction wrappers', () => {
    it('recognises Safe execTransaction (0x6a761202) as a known wrapper and marks inner calldata opaque', async () => {
      const safeAddress = '0x0b8f413521d4a9307b34d7d3d2dbb26fcfe97305' as const;
      const calldata =
        '0x6a7612020000000000000000000000002acbf518b3759f6e1fa163294eda55bf1d0ae0510000000000000000000000000000000000000000000000000000000000000000' as const;

      const result = await decodeProposalActions({
        network: 'ethereum',
        targets: [safeAddress],
        values: [0n],
        signatures: [''],
        calldatas: [calldata],
        client: mockClient,
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.isSafeWrapper).toBe(true);
      expect(action.decoded).toBe(false); // Inner calls are NOT pretended to be decoded
      expect(action.functionName).toContain('Safe Transaction Wrapper');
      expect(action.limitations?.[0]).toContain('Safe wrapper (0x6a761202)');
      expect(result.limitations[0]).toContain('Safe wrapper (0x6a761202)');
    });

    it('generates a specific opaque Safe wrapper finding with medium severity', () => {
      const action: ProposalAction = {
        index: 0,
        target: '0x0b8f413521d4a9307b34d7d3d2dbb26fcfe97305',
        value: '0',
        signature: 'execTransaction(...)',
        selector: '0x6a761202',
        decoded: false,
        isSafeWrapper: true,
        rawCalldata: '0x6a761202...',
      };

      const findings = detectFindings([action]);
      const safeFinding = findings.find((f) => f.id.startsWith('SAFE_WRAPPER_OPAQUE'));

      expect(safeFinding).toBeDefined();
      expect(safeFinding?.severity).toBe('medium');
      expect(safeFinding?.title).toContain('Safe transaction wrapper');
      expect(safeFinding?.description).toContain('Inner payload calls are opaque');
    });

    it('marks overall assessment as analysis_incomplete when Safe wrapper inner calls cannot be inspected', () => {
      const action: ProposalAction = {
        index: 0,
        target: '0x0b8f413521d4a9307b34d7d3d2dbb26fcfe97305',
        value: '0',
        signature: 'execTransaction(...)',
        selector: '0x6a761202',
        decoded: false,
        isSafeWrapper: true,
        rawCalldata: '0x6a761202...',
      };

      const assessment = buildAssessment({
        actions: [action],
        findings: [
          {
            id: 'SAFE_WRAPPER_OPAQUE_0',
            severity: 'medium',
            title: 'Action #1 executes via Safe transaction wrapper',
            description: 'Inner payload calls are opaque.',
            actionIndex: 0,
            target: action.target,
            verified: true,
            whyItMatters: 'Safe wrapper conceals inner transactions.',
          },
        ],
        consistency: {
          status: 'consistent',
          explanation: 'Description matches.',
        },
      });

      expect(assessment).toBe('analysis_incomplete');
    });
  });

  // Area F: Severity calibration (Ownership-transfer proposals)
  describe('Area F: Severity calibration for ownership transfers', () => {
    it('calibrates ownership transfer to a governance Timelock as medium severity', () => {
      const action: ProposalAction = {
        index: 0,
        target: dummyGovernor,
        targetName: 'TimelockController',
        value: '0',
        signature: 'transferOwnership(address)',
        selector: '0xf2fde38b',
        decoded: true,
        functionName: 'transferOwnership',
        args: [{ name: 'newOwner', type: 'address', value: recipientBob }],
        rawCalldata: '0xf2fde38b...',
      };

      const findings = detectFindings([action]);
      const finding = findings.find((f) => f.id.startsWith('SENSITIVE_TRANSFER_OWNERSHIP'));

      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('medium');
      expect(finding?.title).toContain('transfers ownership to governance Timelock');
    });

    it('calibrates ownership transfer to an external address as high severity (not critical)', () => {
      const action: ProposalAction = {
        index: 0,
        target: dummyGovernor,
        value: '0',
        signature: 'transferOwnership(address)',
        selector: '0xf2fde38b',
        decoded: true,
        functionName: 'transferOwnership',
        args: [{ name: 'newOwner', type: 'address', value: recipientBob }],
        rawCalldata: '0xf2fde38b...',
      };

      const findings = detectFindings([action]);
      const finding = findings.find((f) => f.id.startsWith('SENSITIVE_TRANSFER_OWNERSHIP'));

      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
      expect(finding?.severity).not.toBe('critical');
      expect(finding?.title).toContain('transfers contract ownership');
    });

    it('calibrates renouncing ownership (zero address) as high severity', () => {
      const action: ProposalAction = {
        index: 0,
        target: dummyGovernor,
        value: '0',
        signature: 'transferOwnership(address)',
        selector: '0xf2fde38b',
        decoded: true,
        functionName: 'transferOwnership',
        args: [{ name: 'newOwner', type: 'address', value: '0x0000000000000000000000000000000000000000' }],
        rawCalldata: '0xf2fde38b...',
      };

      const findings = detectFindings([action]);
      const finding = findings.find((f) => f.id.startsWith('SENSITIVE_TRANSFER_OWNERSHIP'));

      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');
      expect(finding?.title).toContain('renounces contract ownership');
    });
  });

  // Area G: Recipient identity consistency (Unlock Protocol Base demo)
  describe('Area G: Recipient identity consistency', () => {
    it('returns indeterminate rather than a false recipient mismatch when address is not explicitly named', () => {
      const action: ProposalAction = {
        index: 0,
        target: usdcMainnet,
        targetName: 'USDC',
        value: '0',
        signature: 'transfer(address,uint256)',
        selector: '0xa9059cbb',
        decoded: true,
        functionName: 'transfer',
        tokenSymbol: 'USDC',
        tokenDecimals: 6,
        args: [
          { name: 'to', type: 'address', value: recipientAlice },
          { name: 'amount', type: 'uint256', value: '1000000000' }, // 1,000 USDC
        ],
        rawCalldata: '0xa9059cbb...',
      };

      // Description discusses funding for the Unlock team and mentions contract addresses, but doesn't explicitly designate recipient hex
      const desc = `Proposal to fund Unlock Protocol team with 1000 USDC. Protocol registry is at 0x9999999999999999999999999999999999999999.`;
      const consistency = checkDescriptionActionConsistency(desc, [action]);

      // Missing wallet address in proposal description is an omission -> indeterminate, NOT an inconsistent contradiction
      expect(consistency.status).toBe('indeterminate');
      expect(consistency.discrepancies).toBeUndefined();
      expect(consistency.omissions?.length).toBeGreaterThan(0);
      expect(consistency.omissions?.[0]).toContain('is not specified in the description text');
    });

    it('correctly flags a genuine recipient contradiction when an explicit recipient differs', () => {
      const action: ProposalAction = {
        index: 0,
        target: usdcMainnet,
        targetName: 'USDC',
        value: '0',
        signature: 'transfer(address,uint256)',
        selector: '0xa9059cbb',
        decoded: true,
        functionName: 'transfer',
        tokenSymbol: 'USDC',
        tokenDecimals: 6,
        args: [
          { name: 'to', type: 'address', value: recipientAlice },
          { name: 'amount', type: 'uint256', value: '1000000000' },
        ],
        rawCalldata: '0xa9059cbb...',
      };

      // Description explicitly designates Bob as the recipient, but action sends to Alice
      const desc = `Disburse funds: transfer to recipient ${recipientBob} of 1000 USDC.`;
      const consistency = checkDescriptionActionConsistency(desc, [action]);

      expect(consistency.status).toBe('inconsistent');
      expect(consistency.discrepancies?.some((d) => d.includes('Recipient mismatch'))).toBe(true);
    });
  });
});
