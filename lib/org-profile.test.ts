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

  it('parses currentSponsors and geo fields when present', () => {
    const result = parseOrgProfile({
      name: 'Club',
      currentSponsors: ['Acme Co', 'Beta Inc'],
      city: 'Saskatoon',
      region: 'Saskatchewan',
      country: 'Canada',
      lat: 52.1332,
      lng: -106.67,
    });
    expect(result.currentSponsors).toEqual(['Acme Co', 'Beta Inc']);
    expect(result.city).toBe('Saskatoon');
    expect(result.region).toBe('Saskatchewan');
    expect(result.country).toBe('Canada');
    expect(result.lat).toBe(52.1332);
    expect(result.lng).toBe(-106.67);
  });

  it('leaves currentSponsors and geo undefined when absent, without throwing', () => {
    const result = parseOrgProfile({ name: 'Club' });
    expect(result.currentSponsors).toBeUndefined();
    expect(result.lat).toBeUndefined();
  });

  it('does not crash on malformed currentSponsors or geo values', () => {
    const result = parseOrgProfile({
      name: 'Club',
      currentSponsors: [1, null, 'Real Sponsor'],
      lat: 'not-a-number',
      lng: null,
    });
    expect(() => result).not.toThrow();
    expect(result.currentSponsors).toEqual(['Real Sponsor']);
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
  });
});
