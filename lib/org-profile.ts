import { z } from 'zod';

export interface OrgProfile {
  name: string;
  location: string;
  sport: string;
  organisationType: string;
  audience: string[];
  programs: string[];
  fundingNeeds: string[];
  currentSponsors?: string[];
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lng?: number;
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
  currentSponsors: z.array(z.string()).optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseOrgProfile(input: unknown): OrgProfile {
  const result = partialProfileSchema.safeParse(input);
  if (result.success) return result.data;
  // Fall back field-by-field so a malformed single field doesn't blank everything.
  // Non-string array elements are dropped (not passed through) — the schema
  // requires string[], and passing mixed-type elements through would make the
  // final .parse() below throw, defeating the whole point of this fallback.
  const raw = (input ?? {}) as Record<string, unknown>;
  return partialProfileSchema.parse({
    name: typeof raw.name === 'string' ? raw.name : '',
    location: typeof raw.location === 'string' ? raw.location : '',
    sport: typeof raw.sport === 'string' ? raw.sport : '',
    organisationType: typeof raw.organisationType === 'string' ? raw.organisationType : '',
    audience: toStringArray(raw.audience),
    programs: toStringArray(raw.programs),
    fundingNeeds: toStringArray(raw.fundingNeeds),
    currentSponsors: toOptionalStringArray(raw.currentSponsors),
    city: toOptionalString(raw.city),
    region: toOptionalString(raw.region),
    country: toOptionalString(raw.country),
    lat: toOptionalNumber(raw.lat),
    lng: toOptionalNumber(raw.lng),
  });
}

export function emptyOrgProfile(): OrgProfile {
  return partialProfileSchema.parse({});
}
