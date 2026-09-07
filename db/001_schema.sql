-- ============================================================
-- SPORTSFIRST SPONSOR AGENT - MVP DATABASE SCHEMA
-- PostgreSQL
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE organisation_type_enum AS ENUM (
  'club',
  'league',
  'federation',
  'academy',
  'nonprofit',
  'event',
  'other'
);

CREATE TYPE company_size_enum AS ENUM (
  'local',
  'regional',
  'national',
  'global',
  'unknown'
);

CREATE TYPE relationship_type_enum AS ENUM (
  'sponsor',
  'partner',
  'principal_partner',
  'naming_rights',
  'event_partner',
  'program_partner',
  'equipment_partner',
  'media_partner',
  'other'
);

CREATE TYPE relationship_status_enum AS ENUM (
  'active',
  'historical',
  'unknown'
);

CREATE TYPE confidence_enum AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE match_classification_enum AS ENUM (
  'exceptional',
  'strong',
  'good',
  'explore'
);

CREATE TYPE match_status_enum AS ENUM (
  'new',
  'saved',
  'rejected',
  'contacted',
  'follow_up',
  'meeting',
  'proposal_sent',
  'negotiation',
  'won',
  'lost'
);

CREATE TYPE evidence_type_enum AS ENUM (
  'sponsorship_program',
  'sports_sponsorship',
  'same_sport_sponsorship',
  'grassroots_sponsorship',
  'community_program',
  'youth_program',
  'local_presence',
  'csr_program',
  'existing_sponsorship',
  'event_sponsorship',
  'cause_alignment',
  'audience_alignment',
  'other'
);

CREATE TYPE source_type_enum AS ENUM (
  'company_official',
  'club_official',
  'league_official',
  'federation_official',
  'governing_body',
  'government',
  'news',
  'social',
  'directory',
  'other'
);

CREATE TYPE discovery_run_type_enum AS ENUM (
  'sponsor_discovery',
  'evidence_refresh',
  'rescoring',
  'relationship_discovery'
);

CREATE TYPE discovery_run_status_enum AS ENUM (
  'running',
  'completed',
  'failed'
);


-- ============================================================
-- 1. CLUBS
-- Sports organisations using the platform or discovered
-- while building the sponsorship graph.
-- ============================================================

CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  sport TEXT NOT NULL,
  organisation_type organisation_type_enum DEFAULT 'club',

  website_url TEXT,

  city TEXT,
  region TEXT,
  country TEXT,

  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),

  audiences JSONB DEFAULT '[]'::jsonb,
  programs JSONB DEFAULT '[]'::jsonb,
  funding_needs JSONB DEFAULT '[]'::jsonb,
  sponsorship_assets JSONB DEFAULT '[]'::jsonb,

  attributes JSONB DEFAULT '{}'::jsonb,

  profile_verified BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 2. SPONSORS
-- Canonical companies / sponsor entities.
-- ============================================================

CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  normalized_name TEXT,

  category TEXT,
  website_url TEXT,
  domain TEXT,

  company_size company_size_enum DEFAULT 'unknown',

  city TEXT,
  region TEXT,
  country TEXT,

  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),

  supports_sport BOOLEAN,
  supports_grassroots BOOLEAN,
  supports_youth BOOLEAN,
  supports_community BOOLEAN,

  causes JSONB DEFAULT '[]'::jsonb,

  attributes JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. SPONSORSHIP_RELATIONSHIPS
-- The verified graph:
--
-- sponsor X actually sponsors / sponsored club Y.
--
-- Do NOT put speculative prospects here.
-- ============================================================

CREATE TABLE sponsorship_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  club_id UUID NOT NULL
    REFERENCES clubs(id)
    ON DELETE CASCADE,

  sponsor_id UUID NOT NULL
    REFERENCES sponsors(id)
    ON DELETE CASCADE,

  relationship_type relationship_type_enum DEFAULT 'sponsor',

  sport TEXT,

  start_date DATE,
  end_date DATE,

  status relationship_status_enum DEFAULT 'unknown',

  confidence confidence_enum DEFAULT 'medium',

  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,

  attributes JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT unique_sponsor_club_relationship
    UNIQUE (club_id, sponsor_id, relationship_type)
);


-- ============================================================
-- 4. SPONSOR_MATCHES
-- AI / algorithmic prospects for a specific club.
--
-- This table is separate from verified sponsorship relationships.
-- ============================================================

CREATE TABLE sponsor_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  club_id UUID NOT NULL
    REFERENCES clubs(id)
    ON DELETE CASCADE,

  sponsor_id UUID NOT NULL
    REFERENCES sponsors(id)
    ON DELETE CASCADE,

  match_score INTEGER NOT NULL
    CHECK (match_score >= 0 AND match_score <= 100),

  evidence_score INTEGER DEFAULT 0
    CHECK (evidence_score >= 0 AND evidence_score <= 30),

  geography_score INTEGER DEFAULT 0
    CHECK (geography_score >= 0 AND geography_score <= 20),

  sport_score INTEGER DEFAULT 0
    CHECK (sport_score >= 0 AND sport_score <= 15),

  audience_score INTEGER DEFAULT 0
    CHECK (audience_score >= 0 AND audience_score <= 15),

  cause_score INTEGER DEFAULT 0
    CHECK (cause_score >= 0 AND cause_score <= 10),

  scale_score INTEGER DEFAULT 0
    CHECK (scale_score >= 0 AND scale_score <= 5),

  recency_score INTEGER DEFAULT 0
    CHECK (recency_score >= 0 AND recency_score <= 5),

  evidence_confidence confidence_enum DEFAULT 'low',

  classification match_classification_enum,

  match_reason TEXT,

  recommended_angle TEXT,

  estimated_min_amount NUMERIC(12, 2),
  estimated_max_amount NUMERIC(12, 2),

  currency CHAR(3),

  estimate_confidence confidence_enum DEFAULT 'low',

  status match_status_enum DEFAULT 'new',

  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  attributes JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT unique_club_sponsor_match
    UNIQUE (club_id, sponsor_id),

  CONSTRAINT valid_estimated_amount_range
    CHECK (
      estimated_min_amount IS NULL
      OR estimated_max_amount IS NULL
      OR estimated_min_amount <= estimated_max_amount
    )
);


-- ============================================================
-- 5. SPONSOR_EVIDENCE
-- Grounding layer.
--
-- Every important claim about a sponsor should be backed by
-- one or more records here.
-- ============================================================

CREATE TABLE sponsor_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  sponsor_id UUID NOT NULL
    REFERENCES sponsors(id)
    ON DELETE CASCADE,

  related_club_id UUID
    REFERENCES clubs(id)
    ON DELETE SET NULL,

  match_id UUID
    REFERENCES sponsor_matches(id)
    ON DELETE CASCADE,

  relationship_id UUID
    REFERENCES sponsorship_relationships(id)
    ON DELETE CASCADE,

  evidence_type evidence_type_enum NOT NULL,

  claim TEXT NOT NULL,

  source_url TEXT NOT NULL,
  source_title TEXT,
  source_domain TEXT,

  source_type source_type_enum DEFAULT 'other',

  source_date DATE,

  authority_score INTEGER
    CHECK (
      authority_score IS NULL
      OR (
        authority_score >= 0
        AND authority_score <= 100
      )
    ),

  evidence_strength INTEGER
    CHECK (
      evidence_strength IS NULL
      OR (
        evidence_strength >= 0
        AND evidence_strength <= 100
      )
    ),

  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  is_valid BOOLEAN NOT NULL DEFAULT TRUE,

  attributes JSONB DEFAULT '{}'::jsonb
);


-- ============================================================
-- 6. DISCOVERY_RUNS
-- Tracks each sponsor discovery / refresh / scoring run.
--
-- Useful for debugging, analytics and reproducibility.
-- ============================================================

CREATE TABLE discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  club_id UUID NOT NULL
    REFERENCES clubs(id)
    ON DELETE CASCADE,

  run_type discovery_run_type_enum NOT NULL,

  status discovery_run_status_enum NOT NULL DEFAULT 'running',

  search_queries JSONB DEFAULT '[]'::jsonb,

  candidates_found INTEGER DEFAULT 0,
  candidates_qualified INTEGER DEFAULT 0,
  candidates_rejected INTEGER DEFAULT 0,

  model TEXT,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  error_message TEXT,

  metadata JSONB DEFAULT '{}'::jsonb
);


-- ============================================================
-- INDEXES
-- ============================================================

-- Clubs

CREATE INDEX idx_clubs_sport
  ON clubs (sport);

CREATE INDEX idx_clubs_location
  ON clubs (country, region, city);

CREATE INDEX idx_clubs_website
  ON clubs (website_url);


-- Sponsors

CREATE INDEX idx_sponsors_name
  ON sponsors (normalized_name);

CREATE INDEX idx_sponsors_domain
  ON sponsors (domain);

CREATE INDEX idx_sponsors_category
  ON sponsors (category);

CREATE INDEX idx_sponsors_location
  ON sponsors (country, region, city);


-- Sponsorship graph

CREATE INDEX idx_relationships_club
  ON sponsorship_relationships (club_id);

CREATE INDEX idx_relationships_sponsor
  ON sponsorship_relationships (sponsor_id);

CREATE INDEX idx_relationships_status
  ON sponsorship_relationships (status);

CREATE INDEX idx_relationships_sport
  ON sponsorship_relationships (sport);


-- Sponsor matches

CREATE INDEX idx_matches_club
  ON sponsor_matches (club_id);

CREATE INDEX idx_matches_sponsor
  ON sponsor_matches (sponsor_id);

CREATE INDEX idx_matches_club_score
  ON sponsor_matches (club_id, match_score DESC);

CREATE INDEX idx_matches_status
  ON sponsor_matches (status);


-- Evidence

CREATE INDEX idx_evidence_sponsor
  ON sponsor_evidence (sponsor_id);

CREATE INDEX idx_evidence_match
  ON sponsor_evidence (match_id);

CREATE INDEX idx_evidence_relationship
  ON sponsor_evidence (relationship_id);

CREATE INDEX idx_evidence_type
  ON sponsor_evidence (evidence_type);

CREATE INDEX idx_evidence_valid
  ON sponsor_evidence (is_valid);


-- Discovery runs

CREATE INDEX idx_discovery_runs_club
  ON discovery_runs (club_id);

CREATE INDEX idx_discovery_runs_status
  ON discovery_runs (status);

CREATE INDEX idx_discovery_runs_started
  ON discovery_runs (started_at DESC);


-- ============================================================
-- OPTIONAL UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER update_clubs_updated_at
BEFORE UPDATE ON clubs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER update_sponsors_updated_at
BEFORE UPDATE ON sponsors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
