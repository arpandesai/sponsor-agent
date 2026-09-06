import { z } from 'zod';

export interface OrgProfile {
  name: string;
  location: string;
  sport: string;
  organisationType: string;
  audience: string[];
  programs: string[];
  fundingNeeds: string[];
}

const stringArray = z.array(z.string()).default([]);

const partialProfileSchema = z.object({
  name: z.string().default(''),
  location: z.string().default(''),
  sport: z.string().default(''),
  organisationType: z.string().default(''),
  audience: stringArray,
  programs: stringArray,
  fundingNeeds: stringArray,
});

export const orgProfileSchema = partialProfileSchema;

export function parseOrgProfile(input: unknown): OrgProfile {
  const result = partialProfileSchema.safeParse(input);
  if (result.success) return result.data;
  // Fall back field-by-field so a malformed single field doesn't blank everything
  const raw = (input ?? {}) as Record<string, unknown>;
  return partialProfileSchema.parse({
    name: typeof raw.name === 'string' ? raw.name : '',
    location: typeof raw.location === 'string' ? raw.location : '',
    sport: typeof raw.sport === 'string' ? raw.sport : '',
    organisationType: typeof raw.organisationType === 'string' ? raw.organisationType : '',
    audience: Array.isArray(raw.audience) ? raw.audience : [],
    programs: Array.isArray(raw.programs) ? raw.programs : [],
    fundingNeeds: Array.isArray(raw.fundingNeeds) ? raw.fundingNeeds : [],
  });
}

export function emptyOrgProfile(): OrgProfile {
  return partialProfileSchema.parse({});
}
