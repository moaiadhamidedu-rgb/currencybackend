export interface DiscoveredCurrency {
  code: string;
  name: string;
  symbol?: string;
  hasPositiveRate: boolean;
}

export interface FetchedSourceContent {
  sourceUrl: string;
  content: string;
  fetchedAt: Date;
  discoveredCurrencies?: DiscoveredCurrency[];
  sourceTimestampIndicatesFreshness?: boolean;
}

export interface CurrencySourceAdapter {
  readonly slug: string;
  fetchContent(url: string): Promise<FetchedSourceContent>;
}
