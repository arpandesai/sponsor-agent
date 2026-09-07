import { describe, it, expect } from 'vitest';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('returns the message of an Error instance', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns a string rejection value as-is', () => {
    expect(errorMessage('plain string failure')).toBe('plain string failure');
  });

  it('falls back to a generic message for undefined, null, and other non-Error values', () => {
    expect(errorMessage(undefined)).toBe('unknown error');
    expect(errorMessage(null)).toBe('unknown error');
    expect(errorMessage(42)).toBe('unknown error');
    expect(errorMessage({ some: 'object' })).toBe('unknown error');
  });
});
