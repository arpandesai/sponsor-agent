import { describe, it, expect } from 'vitest';
import { parseOrgProfile, emptyOrgProfile } from './org-profile';

describe('parseOrgProfile', () => {
  it('parses a full valid profile', () => {
    const input = {
      name: 'Prairie Fencing Club',
      location: 'Saskatoon, Saskatchewan, Canada',
      sport: 'Fencing',
      organisationType: 'Community Sports Club',
      audience: ['Youth', 'Adults'],
      programs: ['Youth Fencing', 'Adult Fencing'],
      fundingNeeds: ['Equipment', 'Coaching'],
    };
    expect(parseOrgProfile(input)).toEqual(input);
  });

  it('fills missing fields with empty defaults instead of throwing', () => {
    const result = parseOrgProfile({ name: 'Some Club' });
    expect(result.name).toBe('Some Club');
    expect(result.location).toBe('');
    expect(result.audience).toEqual([]);
  });

  it('emptyOrgProfile returns all-blank profile', () => {
    expect(emptyOrgProfile()).toEqual({
      name: '',
      location: '',
      sport: '',
      organisationType: '',
      audience: [],
      programs: [],
      fundingNeeds: [],
    });
  });

  it('never throws for null, undefined, primitive, or array input', () => {
    expect(() => parseOrgProfile(null)).not.toThrow();
    expect(() => parseOrgProfile(undefined)).not.toThrow();
    expect(() => parseOrgProfile('a plain string')).not.toThrow();
    expect(() => parseOrgProfile(42)).not.toThrow();
    expect(() => parseOrgProfile(true)).not.toThrow();
    expect(() => parseOrgProfile([1, 2, 3])).not.toThrow();
    expect(parseOrgProfile(null)).toEqual(emptyOrgProfile());
    expect(parseOrgProfile('a plain string')).toEqual(emptyOrgProfile());
  });

  it('drops non-string elements from array fields instead of throwing', () => {
    const result = parseOrgProfile({
      name: 'Club',
      audience: ['Youth', 42, null, { weird: true }, 'Adults'],
      programs: [1, 2, 3],
      fundingNeeds: 'not-an-array-at-all',
    });
    expect(() => result).not.toThrow();
    expect(result.audience).toEqual(['Youth', 'Adults']);
    expect(result.programs).toEqual([]);
    expect(result.fundingNeeds).toEqual([]);
  });

  it('treats a non-string name/location/sport/organisationType as missing rather than throwing', () => {
    const result = parseOrgProfile({
      name: 12345,
      location: { nested: 'object' },
      sport: ['array', 'not', 'string'],
      organisationType: null,
    });
    expect(() => result).not.toThrow();
    expect(result.name).toBe('');
    expect(result.location).toBe('');
    expect(result.sport).toBe('');
    expect(result.organisationType).toBe('');
  });
});
