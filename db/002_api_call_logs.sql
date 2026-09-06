CREATE TYPE api_call_status_enum AS ENUM ('success', 'error');

CREATE TABLE api_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider TEXT NOT NULL,           -- 'firecrawl' | 'monid_tinyfish' | 'openrouter'
  endpoint TEXT,                    -- '/fetch', '/search', or the OpenRouter model name
  model TEXT,                       -- LLM model, null for scrape/search calls

  status api_call_status_enum NOT NULL,
  error_message TEXT,

  latency_ms INTEGER NOT NULL,
  cost_usd NUMERIC(12, 6),          -- null when the provider doesn't expose per-call cost

  request_summary JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_call_logs_provider ON api_call_logs (provider);
CREATE INDEX idx_api_call_logs_status ON api_call_logs (status);
CREATE INDEX idx_api_call_logs_created ON api_call_logs (created_at DESC);
