import { neon } from '@neondatabase/serverless';
import type { OrgProfile } from './org-profile';
import type { Sponsor } from './openrouter';

let cachedSql: ReturnType<typeof neon> | null = null;

// Lazily created so importing this module never throws when POSTGRES_URL is
// unset (e.g. in unit tests) — only calling a query does.
export function getSql(): ReturnType<typeof neon> {
  if (!cachedSql) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) throw new Error('POSTGRES_URL is not set');
    cachedSql = neon(connectionString);
  }
  return cachedSql;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

async function findOrCreateClub(profile: OrgProfile): Promise<string> {
  const sql = getSql();
  const existing = await sql`SELECT id FROM clubs WHERE lower(name) = ${normalize(profile.name)} LIMIT 1`;
  if (existing.length > 0) {
    const id = existing[0].id as string;
    await sql`
      UPDATE clubs SET
        city = COALESCE(${profile.city ?? null}, city),
        region = COALESCE(${profile.region ?? null}, region),
        country = COALESCE(${profile.country ?? null}, country),
        lat = COALESCE(${profile.lat ?? null}, lat),
        lng = COALESCE(${profile.lng ?? null}, lng)
      WHERE id = ${id}
    `;
    return id;
  }
  const inserted = await sql`
    INSERT INTO clubs (name, sport, city, region, country, lat, lng, audiences, programs, funding_needs)
    VALUES (
      ${profile.name}, ${profile.sport}, ${profile.city ?? null}, ${profile.region ?? null},
      ${profile.country ?? null}, ${profile.lat ?? null}, ${profile.lng ?? null},
      ${JSON.stringify(profile.audience)}, ${JSON.stringify(profile.programs)}, ${JSON.stringify(profile.fundingNeeds)}
    )
    RETURNING id
  `;
  return inserted[0].id as string;
}

async function findOrCreateSponsor(
  name: string,
  extra: { category?: string; city?: string; region?: string; country?: string } = {}
): Promise<string> {
  const sql = getSql();
  const existing = await sql`SELECT id FROM sponsors WHERE normalized_name = ${normalize(name)} LIMIT 1`;
  if (existing.length > 0) return existing[0].id as string;
  const inserted = await sql`
    INSERT INTO sponsors (name, normalized_name, category, city, region, country)
    VALUES (
      ${name}, ${normalize(name)}, ${extra.category ?? null},
      ${extra.city ?? null}, ${extra.region ?? null}, ${extra.country ?? null}
    )
    RETURNING id
  `;
  return inserted[0].id as string;
}

// Best-effort, non-blocking: the sessionStorage-driven UI is the source of
// truth for what the user sees. A DB write failure is logged, never thrown.
export async function persistClubFromProfile(profile: OrgProfile): Promise<void> {
  try {
    const sql = getSql();
    const clubId = await findOrCreateClub(profile);
    for (const name of profile.currentSponsors ?? []) {
      const sponsorId = await findOrCreateSponsor(name);
      await sql`
        INSERT INTO sponsorship_relationships (club_id, sponsor_id, relationship_type, status, confidence)
        VALUES (${clubId}, ${sponsorId}, 'sponsor', 'active', 'medium')
        ON CONFLICT (club_id, sponsor_id, relationship_type) DO NOTHING
      `;
    }
  } catch (err) {
    console.error('persistClubFromProfile failed:', err);
  }
}

export async function persistSponsorDiscovery(profile: OrgProfile, sponsors: Sponsor[]): Promise<void> {
  try {
    const sql = getSql();
    const clubId = await findOrCreateClub(profile);
    let found = 0;
    let qualified = 0;

    for (const sponsor of sponsors) {
      found++;
      const sponsorId = await findOrCreateSponsor(sponsor.name, {
        category: sponsor.category,
        city: sponsor.city,
        region: sponsor.region,
        country: sponsor.country,
      });

      if (sponsor.relationship === 'confirmed_existing') {
        await sql`
          INSERT INTO sponsorship_relationships (club_id, sponsor_id, relationship_type, status, confidence)
          VALUES (${clubId}, ${sponsorId}, 'sponsor', 'active', 'medium')
          ON CONFLICT (club_id, sponsor_id, relationship_type) DO NOTHING
        `;
        continue;
      }

      qualified++;
      const matchResult = await sql`
        INSERT INTO sponsor_matches (
          club_id, sponsor_id, match_score, evidence_score, geography_score, sport_score,
          audience_score, cause_score, scale_score, recency_score, evidence_confidence,
          classification, match_reason, recommended_angle, estimated_min_amount,
          estimated_max_amount, currency, estimate_confidence
        )
        VALUES (
          ${clubId}, ${sponsorId}, ${sponsor.matchScore}, ${sponsor.evidenceScore ?? 0},
          ${sponsor.geographyScore ?? 0}, ${sponsor.sportScore ?? 0}, ${sponsor.audienceScore ?? 0},
          ${sponsor.causeScore ?? 0}, ${sponsor.scaleScore ?? 0}, ${sponsor.recencyScore ?? 0},
          ${sponsor.evidenceConfidence ?? 'low'}, ${sponsor.classification ?? null},
          ${sponsor.matchReason}, ${sponsor.recommendedAngle ?? null}, ${sponsor.estimatedMinUsd},
          ${sponsor.estimatedMaxUsd}, ${sponsor.currency ?? 'USD'}, ${sponsor.estimateConfidence ?? 'low'}
        )
        ON CONFLICT (club_id, sponsor_id) DO UPDATE SET
          match_score = EXCLUDED.match_score,
          match_reason = EXCLUDED.match_reason,
          last_scored_at = NOW()
        RETURNING id
      `;
      const matchId = matchResult[0]?.id as string | undefined;

      for (const evidence of sponsor.evidence ?? []) {
        await sql`
          INSERT INTO sponsor_evidence (sponsor_id, related_club_id, match_id, evidence_type, claim, source_url, source_title)
          VALUES (
            ${sponsorId}, ${clubId}, ${matchId ?? null}, 'other',
            ${evidence.claim}, ${evidence.sourceUrl}, ${evidence.sourceTitle ?? null}
          )
        `;
      }
    }

    await sql`
      INSERT INTO discovery_runs (club_id, run_type, status, candidates_found, candidates_qualified, model, completed_at)
      VALUES (${clubId}, 'sponsor_discovery', 'completed', ${found}, ${qualified}, 'openrouter', NOW())
    `;
  } catch (err) {
    console.error('persistSponsorDiscovery failed:', err);
  }
}
