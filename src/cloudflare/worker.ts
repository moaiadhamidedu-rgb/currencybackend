import { collectRates, CloudflareEnv } from './collector';

interface PublishedRateRow {
  currency: string;
  name: string;
  buy: number;
  sell: number;
  confidence: number;
  status: string;
  updated_at: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    if (request.method === 'OPTIONS')
      return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    try {
      if (
        request.method === 'GET' &&
        (url.pathname === '/' || url.pathname === '/health')
      ) {
        return json({
          success: true,
          service: 'currency-tracker-backend',
          platform: 'cloudflare',
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/rates') {
        return getRates(env);
      }
      const currencyMatch =
        request.method === 'GET'
          ? url.pathname.match(/^\/api\/v1\/rates\/([A-Za-z]{3})$/)
          : null;
      if (currencyMatch) return getRate(env, currencyMatch[1]);

      if (request.method === 'POST' && url.pathname === '/api/v1/collect') {
        if (!env.COLLECT_SECRET) {
          return json(
            { success: false, message: 'COLLECT_SECRET is not configured' },
            503,
          );
        }
        if (
          request.headers.get('Authorization') !==
          `Bearer ${env.COLLECT_SECRET}`
        ) {
          return json({ success: false, message: 'Unauthorized' }, 401);
        }
        return json({ success: true, ...(await collectRates(env)) });
      }
      return json({ success: false, message: 'Not found' }, 404);
    } catch (error) {
      console.error(error);
      return json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : 'Internal server error',
        },
        500,
      );
    }
  },

  scheduled(
    _controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): void {
    ctx.waitUntil(
      collectRates(env)
        .then((result) => console.log('Scheduled collection completed', result))
        .catch((error) => console.error('Scheduled collection failed', error)),
    );
  },
};

async function getRates(env: CloudflareEnv): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT currency, name, buy, sell, confidence, status, updated_at
     FROM published_rates ORDER BY currency ASC`,
  ).all<PublishedRateRow>();
  const rates = result.results ?? [];
  const updatedAt = rates.reduce<string | null>(
    (latest, rate) =>
      !latest || rate.updated_at > latest ? rate.updated_at : latest,
    null,
  );
  return json({
    success: true,
    base: 'SYP',
    denomination: 'new',
    updatedAt,
    rates: rates.map(toPublicRate),
  });
}

async function getRate(env: CloudflareEnv, code: string): Promise<Response> {
  const rate = await env.DB.prepare(
    `SELECT currency, name, buy, sell, confidence, status, updated_at
     FROM published_rates WHERE currency = ?`,
  )
    .bind(code.toUpperCase())
    .first<PublishedRateRow>();
  if (!rate)
    return json(
      {
        success: false,
        message: `No published rate found for ${code.toUpperCase()}`,
      },
      404,
    );
  return json({
    success: true,
    base: 'SYP',
    denomination: 'new',
    updatedAt: rate.updated_at,
    rate: toPublicRate(rate),
  });
}

function toPublicRate(rate: PublishedRateRow) {
  return {
    currency: rate.currency,
    name: rate.name,
    buy: rate.buy,
    sell: rate.sell,
    status: rate.status.toLowerCase(),
    confidence:
      rate.confidence >= 0.8
        ? 'high'
        : rate.confidence >= 0.55
          ? 'medium'
          : 'low',
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
  });
}
