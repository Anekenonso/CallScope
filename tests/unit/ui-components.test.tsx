import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AssessmentBanner } from '../../src/components/AssessmentBanner';
import { ProposalDetails } from '../../src/components/ProposalDetails';
import { ActionList } from '../../src/components/ActionList';
import { FindingsList } from '../../src/components/FindingsList';
import { ConsistencyView } from '../../src/components/ConsistencyView';
import { ProviderReviews } from '../../src/components/ProviderReviews';
import { EvidenceLinks } from '../../src/components/EvidenceLinks';
import { AnalysisProgress } from '../../src/components/AnalysisProgress';
import { Header } from '../../src/components/Header';
import type { ProposalAction, Finding, ProposalInfo } from '../../src/types/analysis';

describe('UI Component Unit Tests (Phase 6)', () => {
  describe('AssessmentBanner', () => {
    it('renders "Review recommended" with warning styles', () => {
      const html = renderToString(
        <AssessmentBanner
          assessment="review_recommended"
          findingsCount={2}
          undecodedCount={0}
        />
      );
      expect(html).toContain('Review recommended');
      expect(html).toContain('assessment-banner-warning');
      expect(html).toContain('2 significant findings identified');
    });

    it('renders "Analysis incomplete" when actions cannot be decoded', () => {
      const html = renderToString(
        <AssessmentBanner
          assessment="analysis_incomplete"
          findingsCount={0}
          undecodedCount={1}
        />
      );
      expect(html).toContain('Analysis incomplete');
      expect(html).toContain('assessment-banner-incomplete');
      expect(html).toContain('1 action could not be verified');
    });

    it('renders "No significant issue detected" with mandatory limitation statement', () => {
      const html = renderToString(
        <AssessmentBanner
          assessment="no_significant_issue_detected"
          findingsCount={0}
          undecodedCount={0}
        />
      );
      expect(html).toContain('No significant issue detected');
      expect(html).toContain('assessment-banner-positive');
      expect(html).toContain('does not constitute an audit or guarantee of safety');
    });
  });

  describe('ProposalDetails', () => {
    const mockProposal: ProposalInfo = {
      id: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
      status: 'Executed',
      description: 'Transfer ownership of ENS root node to security council.',
      proposer: '0x1234567890123456789012345678901234567890',
      blockNumber: '19000000',
      creationTransaction: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    };

    it('renders proposal status, id, and explorer links', () => {
      const html = renderToString(
        <ProposalDetails
          proposal={mockProposal}
          network="ethereum"
          governorAddress="0x323A76393544d5ecca80cd6ef2a560C6a395b7E3"
        />
      );
      expect(html).toContain('Executed');
      expect(html).toContain('77767899528494238518019756391533686963875234067646094287125791110488147463806');
      expect(html).toContain('https://etherscan.io/address/0x323A76393544d5ecca80cd6ef2a560C6a395b7E3');
      expect(html).toContain('Transfer ownership of ENS root node');
    });
  });

  describe('ActionList', () => {
    const mockActions: ProposalAction[] = [
      {
        index: 0,
        target: '0x0000000000000000000000000000000000000001',
        value: '0',
        signature: 'grantRole(bytes32,address)',
        selector: '0x2f2ff15d',
        decoded: true,
        functionName: 'grantRole',
        args: [
          { name: 'role', type: 'bytes32', value: '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e532d04277d' },
          { name: 'account', type: 'address', value: '0x2acBf518b3759f6e1fA163294eda55bF1d0ae051' },
        ],
        rawCalldata: '0x2f2ff15d...',
        targetName: 'TimelockController',
      },
      {
        index: 1,
        target: '0x0000000000000000000000000000000000000002',
        value: '1000000000000000000',
        signature: '',
        selector: '0x12345678',
        decoded: false,
        rawCalldata: '0x12345678deadbeef',
      },
    ];

    it('renders decoded actions with typed arguments and undecoded actions with opaque flags', () => {
      const html = renderToString(<ActionList actions={mockActions} network="ethereum" />);
      expect(html).toMatch(/Actions\s*\([^\d]*2[^\d]*\)/);
      expect(html).toContain('grantRole');
      expect(html).toContain('TimelockController');
      expect(html).toContain('0x2acBf518b3759f6e1fA163294eda55bF1d0ae051');
      expect(html).toContain('Undecoded action');
      expect(html).toContain('0x12345678');
      expect(html).toContain('action-item-undecoded');
    });

    it('handles zero actions gracefully', () => {
      const html = renderToString(<ActionList actions={[]} network="ethereum" />);
      expect(html).toContain('Actions (0)');
      expect(html).toContain('zero executable on-chain calls');
    });
  });

  describe('Header', () => {
    it('renders "Read-only · v0.1 beta" version badge and accessible theme toggle button', () => {
      const html = renderToString(<Header />);
      expect(html).toContain('Read-only · v0.1 beta');
      expect(html).not.toContain('Verified On-Chain · v0.1');
      expect(html).toContain('theme-toggle-icon-btn');
      expect(html).toContain('aria-label');
      expect(html).toContain('title="Theme:');
    });
  });

  describe('FindingsList', () => {
    const mockFindings: Finding[] = [
      {
        id: 'SENSITIVE_ROLE_GRANT_PROPOSER_ROLE',
        severity: 'high',
        title: 'Sensitive Timelock Role Grant: PROPOSER_ROLE',
        description: 'Proposal grants PROPOSER_ROLE to 0x2acBf518b3759f6e1fA163294eda55bF1d0ae051.',
        actionIndex: 0,
        verified: true,
        whyItMatters: 'PROPOSER_ROLE allows scheduling arbitrary transactions through the Timelock.',
      },
    ];

    it('renders findings with severity, action tag, and why it matters', () => {
      const html = renderToString(<FindingsList findings={mockFindings} />);
      expect(html).toMatch(/Findings\s*\([^\d]*1[^\d]*\)/);
      expect(html).toContain('HIGH');
      expect(html).toMatch(/Action\s*#[^\d]*1/);
      expect(html).toContain('Role hash matched');
      expect(html).not.toContain('Verified on-chain');
      expect(html).toContain('Why it matters:');
      expect(html).toContain('PROPOSER_ROLE allows scheduling arbitrary transactions');
    });

    it('renders findings with "Decoded from calldata" pill for non-role actions', () => {
      const calldataFinding: Finding = {
        id: 'NATIVE_VALUE_TRANSFER_0',
        severity: 'medium',
        title: 'Action #1 transfers native ETH',
        description: 'Action transfers 1 ETH to 0x123.',
        actionIndex: 0,
        verified: true,
        verificationBadge: 'Decoded from calldata',
        whyItMatters: 'Treasury transfer',
      };
      const html = renderToString(<FindingsList findings={[calldataFinding]} />);
      expect(html).toContain('Decoded from calldata');
      expect(html).not.toContain('Verified on-chain');
    });

    it('renders empty findings state cleanly', () => {
      const html = renderToString(<FindingsList findings={[]} />);
      expect(html).toContain('Findings (0)');
      expect(html).toContain('No sensitive permissions, contract upgrades, or high-risk operations detected');
    });
  });

  describe('ConsistencyView', () => {
    it('renders consistent description status', () => {
      const html = renderToString(
        <ConsistencyView
          consistency={{
            status: 'consistent',
            explanation: 'All 6 executable transfer actions correspond directly to description claims.',
          }}
        />
      );
      expect(html).toContain('Consistent');
      expect(html).toContain('consistency-consistent');
    });

    it('renders inconsistencies and omissions when present', () => {
      const html = renderToString(
        <ConsistencyView
          consistency={{
            status: 'inconsistent',
            explanation: 'Description fails to declare administrative role grant.',
            omissions: ['Action #1 grantRole not mentioned in description text.'],
            discrepancies: ['Claimed transfer of 100 USDC but calldata executes 1000 USDC.'],
          }}
        />
      );
      expect(html).toContain('Inconsistent');
      expect(html).toContain('consistency-inconsistent');
      expect(html).toContain('Action #1 grantRole not mentioned');
      expect(html).toContain('Claimed transfer of 100 USDC');
    });
  });

  describe('ProviderReviews', () => {
    it('renders available, not_configured, and error states cleanly', () => {
      const html = renderToString(
        <ProviderReviews
          serv={{
            status: 'available',
            summary: 'SERV analysis confirms actions match text.',
            findings: ['Observation 1: Recipients match.'],
          }}
          dolphin={{
            status: 'not_configured',
          }}
        />
      );
      expect(html).toContain('OpenServ SERV');
      expect(html).toContain('Available');
      expect(html).toContain('SERV analysis confirms actions match text.');
      expect(html).toContain('Dolphin');
      expect(html).toContain('Not configured');
      expect(html).toContain('The deterministic analysis engine remains authoritative.');
    });
  });

  describe('EvidenceLinks', () => {
    it('renders explorer links and analysis limitations', () => {
      const html = renderToString(
        <EvidenceLinks
          evidence={[
            {
              label: 'Governor Contract',
              url: 'https://etherscan.io/address/0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
              description: '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
            },
          ]}
          limitations={['Analysis limited to verified contracts.']}
        />
      );
      expect(html).toContain('Evidence &amp; verification');
      expect(html).toContain('Governor Contract');
      expect(html).toContain('https://etherscan.io/address/0x323A76393544d5ecca80cd6ef2a560C6a395b7E3');
      expect(html).toContain('Analysis limited to verified contracts.');
    });
  });

  describe('AnalysisProgress', () => {
    it('renders honest indeterminate progress indicator with tags and elapsed timer', () => {
      const html = renderToString(
        <AnalysisProgress
          network="ethereum"
          governorAddress="0x323A76393544d5ecca80cd6ef2A560C6a395b7E3"
          proposalId="77767899528494238518019756391533686963875234067646094287125791110488147463806"
        />
      );
      expect(html).toContain('Analysing on-chain proposal');
      expect(html).toContain('ETHEREUM');
      expect(html).toContain('0x323A76...95b7E3');
      expect(html).toContain('7776789952');
      expect(html).toContain('Executing deterministic on-chain governance inspection pipeline...');
      expect(html).toContain('Elapsed');
      expect(html).toContain('analysis-progress-card');
      expect(html).toContain('progress-bar-shimmer');
    });
  });
});
