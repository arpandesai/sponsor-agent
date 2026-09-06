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
});
