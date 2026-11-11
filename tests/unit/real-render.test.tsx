import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { executeAnalysis } from '../../api/_analyse';
import { AssessmentBanner } from '../../src/components/AssessmentBanner';
import { ProposalDetails } from '../../src/components/ProposalDetails';
import { ActionList } from '../../src/components/ActionList';
import { FindingsList } from '../../src/components/FindingsList';
import { ConsistencyView } from '../../src/components/ConsistencyView';
import { ProviderReviews } from '../../src/components/ProviderReviews';
import { EvidenceLinks } from '../../src/components/EvidenceLinks';

describe('Real Response Rendering Diagnostic', () => {
  it('renders all components with live ENS proposal result', async () => {
    const result = await executeAnalysis({
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
    });

    console.log('Result assessment:', result.assessment);
    console.log('Proposal:', result.proposal);
    console.log('Actions count:', result.actions.length);
    console.log('First action:', result.actions[0]);
    console.log('Reviews:', result.reviews);

    const bannerHtml = renderToString(
      <AssessmentBanner
        assessment={result.assessment}
        findingsCount={result.findings.length}
        undecodedCount={result.actions.filter((a) => !a.decoded).length}
      />
    );
    expect(bannerHtml.length).toBeGreaterThan(0);

    const detailsHtml = renderToString(
      <ProposalDetails
        proposal={result.proposal}
        network={result.network}
        governorAddress={result.governorAddress}
      />
    );
    expect(detailsHtml.length).toBeGreaterThan(0);

    const actionsHtml = renderToString(
      <ActionList actions={result.actions} network={result.network} />
    );
    expect(actionsHtml.length).toBeGreaterThan(0);

    const findingsHtml = renderToString(
      <FindingsList findings={result.findings} />
    );
    expect(findingsHtml.length).toBeGreaterThan(0);

    const consistencyHtml = renderToString(
      <ConsistencyView consistency={result.descriptionConsistency} />
    );
    expect(consistencyHtml.length).toBeGreaterThan(0);

    const reviewsHtml = renderToString(
      <ProviderReviews
        serv={result.reviews.serv}
        dolphin={result.reviews.dolphin}
      />
    );
    expect(reviewsHtml.length).toBeGreaterThan(0);

    const evidenceHtml = renderToString(
      <EvidenceLinks
        evidence={result.evidence}
        limitations={result.limitations}
      />
    );
    expect(evidenceHtml.length).toBeGreaterThan(0);
  }, 45000);
});

