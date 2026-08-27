CREATE TABLE IF NOT EXISTS published_rates (
  currency TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  buy REAL NOT NULL,
  sell REAL NOT NULL,
  mid REAL NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'FRESH',
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_updated_at TEXT,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  source_count INTEGER NOT NULL DEFAULT 1,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  rate_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);

CREATE TABLE IF NOT EXISTS rate_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_run_id INTEGER NOT NULL,
  currency TEXT NOT NULL,
  old_buy REAL NOT NULL,
  old_sell REAL NOT NULL,
  buy REAL NOT NULL,
  sell REAL NOT NULL,
  mid REAL NOT NULL,
  source_url TEXT NOT NULL,
  source_updated_at TEXT,
  fetched_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  FOREIGN KEY (collection_run_id) REFERENCES collection_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_observations_currency_fetched
  ON rate_observations(currency, fetched_at);
CREATE INDEX IF NOT EXISTS idx_observations_run
  ON rate_observations(collection_run_id);
