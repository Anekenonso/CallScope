import { describe, it, expect } from 'vitest';
import { validateAnalysisInput, parseTxHashOrUrl } from '../../src/lib/validation';

describe('validateAnalysisInput', () => {
  it('passes on valid Ethereum inputs', () => {
    const result = validateAnalysisInput(
      'ethereum',
      '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      '77767899528494238518019756391533686963875234067646094287125791110488147463806'
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('passes on valid Base inputs', () => {
    const result = validateAnalysisInput(
      'base',
      '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
      '27419154582993156392805749742953507877176483681373228046916881327937839104508'
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects unsupported networks', () => {
    const result = validateAnalysisInput(
      'polygon',
      '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      '1'
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.network).toBeDefined();
  });

  it('rejects invalid governor addresses', () => {
    const result = validateAnalysisInput(
      'ethereum',
      '0xinvalid',
      '1'
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.governorAddress).toBeDefined();
  });

  it('rejects non-numeric proposal IDs', () => {
    const result = validateAnalysisInput(
      'ethereum',
      '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      '0xabc'
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.proposalId).toBeDefined();
  });

  it('parses valid raw tx hash', () => {
    const parsed = parseTxHashOrUrl('0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90');
    expect(parsed).not.toBeNull();
    expect(parsed?.txHash).toBe('0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90');
    expect(parsed?.inferredNetwork).toBeUndefined();
  });

  it('parses Etherscan tx URL and infers ethereum network', () => {
    const parsed = parseTxHashOrUrl('https://etherscan.io/tx/0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90');
    expect(parsed).not.toBeNull();
    expect(parsed?.txHash).toBe('0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90');
    expect(parsed?.inferredNetwork).toBe('ethereum');
  });

  it('parses Basescan tx URL and infers base network', () => {
    const parsed = parseTxHashOrUrl('https://basescan.org/tx/0xa7ba89ff0db229f6f00b01d9d5f006c1db8c0591ffba8c7cb1c6f6b5e0d5b385');
    expect(parsed).not.toBeNull();
    expect(parsed?.txHash).toBe('0xa7ba89ff0db229f6f00b01d9d5f006c1db8c0591ffba8c7cb1c6f6b5e0d5b385');
    expect(parsed?.inferredNetwork).toBe('base');
  });

  it('validates tx hash or URL input correctly', () => {
    const valid = validateAnalysisInput('ethereum', '', '', '0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90');
    expect(valid.isValid).toBe(true);

    const invalid = validateAnalysisInput('ethereum', '', '', '0xinvalidhash');
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.txHashOrUrl).toBeDefined();

    const emptyTx = validateAnalysisInput('ethereum', '', '', '', 'tx');
    expect(emptyTx.isValid).toBe(false);
    expect(emptyTx.errors.txHashOrUrl).toBe('Please enter a transaction hash or explorer URL.');

    const whitespaceTx = validateAnalysisInput('ethereum', '', '', '   ', 'tx');
    expect(whitespaceTx.isValid).toBe(false);
    expect(whitespaceTx.errors.txHashOrUrl).toBe('Please enter a transaction hash or explorer URL.');
  });
});
