import { describe, it, expect } from 'vitest';
import { validateAnalysisInput } from '../../src/lib/validation';

describe('validateAnalysisInput', () => {
  it('passes on valid Ethereum inputs', () => {
    const result = validateAnalysisInput(
      'ethereum',
      '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
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
      '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
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
      '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
      '0xabc'
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.proposalId).toBeDefined();
  });
});

