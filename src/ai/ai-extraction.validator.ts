import { AiBatchExtractionResult, ExtractedRate } from './ai.types';

export function validateBatchExtraction(
  value: unknown,
  requestedCurrencies: string[],
  providerName: string,
): AiBatchExtractionResult {
  if (!value || typeof value !== 'object') {
    throw new Error(`${providerName} extraction must be a JSON object`);
  }
  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.rates) || !Array.isArray(result.notFound)) {
    throw new Error(
      `${providerName} returned an invalid batch extraction shape`,
    );
  }

  const requested = new Set(
    requestedCurrencies.map((code) => code.toUpperCase()),
  );
  const seen = new Set<string>();
  const rates = result.rates.map((item) => {
    const rate = validateRate(item, requested, providerName);
    if (seen.has(rate.currency)) {
      throw new Error(
        `${providerName} returned duplicate ${rate.currency} rates`,
      );
    }
    seen.add(rate.currency);
    return rate;
  });
  const declaredNotFound = result.notFound.map((code) => {
    if (typeof code !== 'string' || !requested.has(code.toUpperCase())) {
      throw new Error(`${providerName} returned an invalid notFound currency`);
    }
    return code.toUpperCase();
  });
  const notFound = requestedCurrencies
    .map((code) => code.toUpperCase())
    .filter((code) => !seen.has(code));

  if (declaredNotFound.some((code) => seen.has(code))) {
    throw new Error(
      `${providerName} marked an extracted currency as not found`,
    );
  }
  return { rates, notFound };
}

function validateRate(
  value: unknown,
  requested: Set<string>,
  providerName: string,
): ExtractedRate {
  if (!value || typeof value !== 'object') {
    throw new Error(`${providerName} returned a non-object rate`);
  }
  const result = value as Record<string, unknown>;
  const currency =
    typeof result.currency === 'string' ? result.currency.toUpperCase() : '';
  const buy = Number(result.buy);
  const sell = Number(result.sell);
  const confidence = Number(result.confidence);
  const unit = result.unit;
  const timestamp = result.sourceUpdatedAt;
  if (
    !requested.has(currency) ||
    result.base !== 'SYP' ||
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    buy <= 0 ||
    sell <= 0 ||
    sell < buy ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    (unit !== 'OLD_SYP' && unit !== 'NEW_SYP') ||
    (timestamp !== null &&
      timestamp !== undefined &&
      typeof timestamp !== 'string')
  ) {
    throw new Error(`${providerName} returned an invalid rate extraction`);
  }
  return {
    currency,
    base: 'SYP',
    buy,
    sell,
    unit,
    sourceUpdatedAt: timestamp ?? null,
    confidence,
  };
}
