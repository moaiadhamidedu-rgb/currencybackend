import { normalizeSpTodayRates, parseSpTodayRates } from './sp-today';

export interface CloudflareEnv {
  DB: D1Database;
  COLLECT_SECRET?: string;
  SP_TODAY_URL?: string;
}

export interface CollectionResult {
  runId: number;
  status: 'COMPLETED' | 'FAILED';
  rateCount: number;
}

const DEFAULT_SOURCE_URL = 'https://www.sp-today.com/currencies';

export async function collectRates(
  env: CloudflareEnv,
): Promise<CollectionResult> {
  const startedAt = new Date().toISOString();
  const run = await env.DB.prepare(
    `INSERT INTO collection_runs (status, started_at, source_count)
     VALUES ('RUNNING', ?, 1) RETURNING id`,
  )
    .bind(startedAt)
    .first<{ id: number }>();
  if (!run) throw new Error('Could not create collection run');

  try {
    const fetched = await fetchSpToday(env.SP_TODAY_URL ?? DEFAULT_SOURCE_URL);
    const contentHash = await sha256(fetched.content);
    const parsed = parseSpTodayRates(fetched.content);
    const rates = normalizeSpTodayRates(parsed);
    if (rates.length === 0) {
      throw new Error('SP Today returned no positive currency rates');
    }

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    for (const rate of rates) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO rate_observations
             (collection_run_id, currency, old_buy, old_sell, buy, sell, mid,
              source_url, source_updated_at, fetched_at, content_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          run.id,
          rate.code,
          rate.buy,
          rate.sell,
          rate.normalizedBuy,
          rate.normalizedSell,
          rate.normalizedMid,
          fetched.sourceUrl,
          rate.sourceUpdatedAt,
          now,
          contentHash,
        ),
        env.DB.prepare(
          `INSERT INTO published_rates
             (currency, name, buy, sell, mid, confidence, status, source,
              source_url, source_updated_at, published_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0.95, 'FRESH', 'SP Today', ?, ?, ?, ?)
           ON CONFLICT(currency) DO UPDATE SET
             name = excluded.name,
             buy = excluded.buy,
             sell = excluded.sell,
             mid = excluded.mid,
             confidence = excluded.confidence,
             status = 'FRESH',
             source = excluded.source,
             source_url = excluded.source_url,
             source_updated_at = excluded.source_updated_at,
             published_at = excluded.published_at,
             updated_at = excluded.updated_at`,
        ).bind(
          rate.code,
          rate.name,
          rate.normalizedBuy,
          rate.normalizedSell,
          rate.normalizedMid,
          fetched.sourceUrl,
          rate.sourceUpdatedAt,
          now,
          now,
        ),
      );
    }

    statements.push(
      env.DB.prepare(
        `UPDATE collection_runs
         SET status = 'COMPLETED', completed_at = ?, success_count = 1,
             failure_count = 0, rate_count = ?
         WHERE id = ?`,
      ).bind(now, rates.length, run.id),
    );
    await env.DB.batch(statements);
    return { runId: run.id, status: 'COMPLETED', rateCount: rates.length };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = errorMessage(error).slice(0, 1000);
    await env.DB.batch([
      env.DB.prepare(`UPDATE published_rates SET status = 'STALE'`),
      env.DB.prepare(
        `UPDATE collection_runs
         SET status = 'FAILED', completed_at = ?, failure_count = 1,
             error_summary = ? WHERE id = ?`,
      ).bind(completedAt, message, run.id),
    ]);
    throw error;
  }
}

async function fetchSpToday(
  url: string,
): Promise<{ content: string; sourceUrl: string }> {
  let response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'User-Agent': 'CurrencyTrackerBackend/1.0 (+public-rate-collector)',
    },
  });

  if (!response.ok) {
    const sourceUrl = new URL(url);
    sourceUrl.hostname = sourceUrl.hostname.replace(/^www\./, '');
    const fallbackUrl = `https://r.jina.ai/http://${sourceUrl.host}${sourceUrl.pathname}${sourceUrl.search}`;
    response = await fetch(fallbackUrl, {
      headers: { Accept: 'text/plain,text/markdown;q=0.9,*/*;q=0.8' },
    });
  }

  if (!response.ok) {
    throw new Error(`SP Today fetch failed with HTTP ${response.status}`);
  }
  const content = await response.text();
  if (!content.trim()) throw new Error('SP Today returned empty content');
  return { content, sourceUrl: response.url || url };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
