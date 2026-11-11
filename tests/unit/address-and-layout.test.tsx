import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Address } from '../../src/components/Address';
import { ProposalDetails } from '../../src/components/ProposalDetails';
import type { ProposalInfo } from '../../src/types/analysis';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Task 3: Layout Collisions & Address Component', () => {
  const mockProposal: ProposalInfo = {
    id: '27419154582993156392805749742953507877176483681373228046916881327937839104508',
    title: 'Unlock Protocol Transfers',
    description: 'A long proposal description with lots of details to verify responsive wrapping.',
    status: 'Executed',
    proposer: '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E',
    creationTransaction: '0xa7ba89ff0db229f6f00b01d9d5f006c1db8c0591ffba8c7cb1c6f6b5e0d5b385',
    blockNumber: '52891503',
    eventSource: 'pinned snapshot (block 52891503)',
  };

  it('renders Address component with middle ellipsis, tooltip, and copy button', () => {
    const html = renderToString(
      <Address
        value="0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9"
        explorerUrl="https://basescan.org/address/0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9"
        label="Governor"
      />
    );

    // Truncated text (e.g. 0x65bA...0aD9)
    expect(html).toContain('0x65bA...0aD9');
    // Full address retained in title tooltip
    expect(html).toContain('title="0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9"');
    // Copy button present
    expect(html).toContain('aria-label="Copy Governor"');
    // Expand button present
    expect(html).toContain('aria-label="Expand full Governor"');
  });

  it('renders ProposalDetails with min-width: 0 and overflow-wrap anywhere styles', () => {
    const html = renderToString(
      <ProposalDetails
        proposal={mockProposal}
        network="base"
        governorAddress="0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9"
      />
    );

    expect(html).toContain('0x65bA...0aD9');
    expect(html).toContain('0x9999...f08E');
    expect(html).toContain('27419154582993156392805749742953507877176483681373228046916881327937839104508');
    expect(html).toContain('overflow-wrap:anywhere');
  });

  it('verifies CSS contains min-width: 0 and overflow-wrap for grid children', () => {
    const cssPath = path.resolve(process.cwd(), 'src', 'styles', 'index.css');
    const css = fs.readFileSync(cssPath, 'utf-8');

    // Assert grid children have min-width: 0 to prevent flex/grid blowout
    expect(css).toContain('.details-grid > *');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('overflow-wrap: anywhere');
  });
});

