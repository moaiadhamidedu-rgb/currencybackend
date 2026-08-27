export interface SpTodayRate {
  code: string;
  buy: number;
  sell: number;
  sourceUpdatedAt: string | null;
}

export interface PublishedRateInput extends SpTodayRate {
  name: string;
  normalizedBuy: number;
  normalizedSell: number;
  normalizedMid: number;
}

const OLD_TO_NEW_SYP_FACTOR = 0.01;

export function parseSpTodayRates(content: string): SpTodayRate[] {
  const unescaped = content.replace(/\\"/g, '"');
  const embeddedPattern =
    /"code":"([A-Z]{3})".*?"cities":\{"damascus":\{"buy":([\d.]+),"sell":([\d.]+).*?"updated_at":"([^"]+)"/gs;
  const embedded = [...unescaped.matchAll(embeddedPattern)].map(
    ([, code, buy, sell, sourceUpdatedAt]) => ({
      code,
      buy: Number(buy),
      sell: Number(sell),
      sourceUpdatedAt,
    }),
  );

  const markdownPattern =
    /^\| \[([A-Z]{3}) [^\]]+\]\([^)]*\) \| [\d,.]+ ([\d,]+) قديمة \| [\d,.]+ ([\d,]+) قديمة \|/gm;
  const markdown = [...content.matchAll(markdownPattern)].map(
    ([, code, buy, sell]) => ({
      code,
      buy: Number(buy.replace(/,/g, '')),
      sell: Number(sell.replace(/,/g, '')),
      sourceUpdatedAt: null,
    }),
  );

  const rates = embedded.length > 0 ? embedded : markdown;
  if (rates.length === 0) {
    throw new Error('SP Today response did not contain currency rates');
  }

  return rates.filter(
    (rate) =>
      /^[A-Z]{3}$/.test(rate.code) &&
      Number.isFinite(rate.buy) &&
      Number.isFinite(rate.sell) &&
      rate.buy > 0 &&
      rate.sell >= rate.buy,
  );
}

export function normalizeSpTodayRates(
  rates: SpTodayRate[],
): PublishedRateInput[] {
  const displayNames = createCurrencyDisplayNames();
  return rates.map((rate) => {
    const normalizedBuy = round(rate.buy * OLD_TO_NEW_SYP_FACTOR);
    const normalizedSell = round(rate.sell * OLD_TO_NEW_SYP_FACTOR);
    return {
      ...rate,
      name: displayNames?.of(rate.code) ?? rate.code,
      normalizedBuy,
      normalizedSell,
      normalizedMid: round((normalizedBuy + normalizedSell) / 2),
    };
  });
}

function createCurrencyDisplayNames(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' });
  } catch {
    return null;
  }
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
