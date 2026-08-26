import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicPageSource } from '../public-page-source.base';
import { DiscoveredCurrency } from '../currency-source.interface';

export interface SpTodayRateRecord {
  code: string;
  buy: number;
  sell: number;
  updatedAt: string;
}

@Injectable()
export class SpTodaySource extends PublicPageSource {
  readonly slug = 'sp-today';

  constructor(config: ConfigService) {
    super(config);
  }

  protected prepareContent(rawContent: string, maxCharacters: number): string {
    return extractSpTodayOldSypRates(rawContent).slice(0, maxCharacters);
  }

  protected discoverCurrencies(rawContent: string): DiscoveredCurrency[] {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
    return parseSpTodayCurrencyDataset(rawContent).map((rate) => ({
      code: rate.code,
      name: displayNames.of(rate.code) ?? rate.code,
      symbol: rate.code,
      hasPositiveRate: rate.buy > 0 && rate.sell > 0,
    }));
  }

  // SP Today exposes the time of the last price change, not page freshness.
  protected sourceTimestampIndicatesFreshness(): boolean {
    return false;
  }
}

export function parseSpTodayCurrencyDataset(html: string): SpTodayRateRecord[] {
  const unescaped = html.replace(/\\"/g, '"');
  const pattern =
    /"code":"([A-Z]{3})".*?"cities":\{"damascus":\{"buy":([\d.]+),"sell":([\d.]+).*?"updated_at":"([^"]+)"/gs;
  const records = [...unescaped.matchAll(pattern)].map(
    ([, code, buy, sell, updatedAt]) => ({
      code,
      buy: Number(buy),
      sell: Number(sell),
      updatedAt,
    }),
  );
  if (records.length === 0) {
    throw new Error(
      'SP Today public page did not contain its currency dataset',
    );
  }
  return records;
}

export function extractSpTodayOldSypRates(html: string): string {
  const lines = parseSpTodayCurrencyDataset(html).map(
    ({ code, buy, sell, updatedAt }) =>
      `currency=${code} base=SYP denomination=OLD_SYP buy=${buy} sell=${sell} sourceUpdatedAt=${updatedAt}`,
  );
  return [
    'SP Today public currency dataset. Values below are explicitly OLD_SYP.',
    ...lines,
  ].join('\n');
}
