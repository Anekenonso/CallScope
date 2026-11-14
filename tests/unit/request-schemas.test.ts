import { describe, it, expect } from 'vitest';
import {
  validateAnalysisRequest,
  validateReviewRequest,
  validateEnvStartup,
  RequestValidationError,
} from '../../server/validation/request-schemas';

describe('API Request Boundary & Environment Validation', () => {
  describe('validateAnalysisRequest', () => {
    it('accepts valid network and governor + proposalId', () => {
      const valid = validateAnalysisRequest({
        network: 'ethereum',
        governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
        proposalId: '12345',
      });
      expect(valid.network).toBe('ethereum');
      expect(valid.governorAddress).toBe('0x323a76393544d5ecca80cd6ef2a560c6a395b7e3');
      expect(valid.proposalId).toBe('12345');
    });

    it('accepts valid txHashOrUrl without governor and proposalId', () => {
      const valid = validateAnalysisRequest({
        network: 'base',
        txHashOrUrl: '0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90',
      });
      expect(valid.network).toBe('base');
      expect(valid.txHashOrUrl).toBe('0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90');
    });

    it('throws RequestValidationError on invalid network', () => {
      expect(() =>
        validateAnalysisRequest({
          network: 'solana',
          governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
          proposalId: '12345',
        })
      ).toThrow(RequestValidationError);
    });

    it('throws RequestValidationError on invalid address', () => {
      expect(() =>
        validateAnalysisRequest({
          network: 'ethereum',
          governorAddress: '0xInvalidAddress',
          proposalId: '12345',
        })
      ).toThrow(RequestValidationError);
    });

    it('throws RequestValidationError when neither governor+proposalId nor txHash is given', () => {
      expect(() =>
        validateAnalysisRequest({
          network: 'ethereum',
        })
      ).toThrow(RequestValidationError);
    });
  });

  describe('validateReviewRequest', () => {
    it('accepts valid review request payload', () => {
      const valid = validateReviewRequest({
        network: 'ethereum',
        governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
        proposalId: '777',
        tier: 'standard',
      });
      expect(valid.tier).toBe('standard');
      expect(valid.proposalId).toBe('777');
    });

    it('rejects invalid tier value', () => {
      expect(() =>
        validateReviewRequest({
          network: 'ethereum',
          governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
          proposalId: '777',
          tier: 'ultra_fast',
        })
      ).toThrow(RequestValidationError);
    });
  });

  describe('validateEnvStartup', () => {
    it('validates default env configuration', () => {
      const config = validateEnvStartup({
        SERV_MODEL: 'serv-swift',
        SERV_DAILY_CAP_USD: '2.50',
      });
      expect(config.servModel).toBe('serv-swift');
      expect(config.servDailyCapUsd).toBe(2.50);
      expect(config.isAiPaused).toBe(false);
    });

    it('throws on unknown model ID', () => {
      expect(() =>
        validateEnvStartup({
          SERV_MODEL: 'gpt-4o-unknown',
        })
      ).toThrow();
    });

    it('throws on invalid daily cap format', () => {
      expect(() =>
        validateEnvStartup({
          SERV_MODEL: 'serv-swift',
          SERV_DAILY_CAP_USD: 'not-a-number',
        })
      ).toThrow('SERV_DAILY_CAP_USD must be a positive number');
    });
  });
});
