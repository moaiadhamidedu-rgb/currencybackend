import { ConfigService } from '@nestjs/config';
import {
  CurrencySourceAdapter,
  FetchedSourceContent,
} from './currency-source.interface';
import { cleanPublicPage } from './source-content.util';

export abstract class PublicPageSource implements CurrencySourceAdapter {
  abstract readonly slug: string;

  constructor(protected readonly config: ConfigService) {}

  async fetchContent(url: string): Promise<FetchedSourceContent> {
    const timeout = Number(
      this.config.get('SOURCE_FETCH_TIMEOUT_MS') ?? 15_000,
    );
    const maxCharacters = Number(
      this.config.get('SOURCE_CONTENT_MAX_CHARS') ?? 50_000,
    );
    let response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': 'CurrencyTrackerBackend/1.0 (+public-rate-collector)',
      },
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) {
      const fallbackUrl = this.fallbackUrl(url, response.status);
      if (fallbackUrl) {
        response = await fetch(fallbackUrl, {
          headers: {
            Accept: 'text/plain,text/markdown;q=0.9,*/*;q=0.8',
            'User-Agent': 'CurrencyTrackerBackend/1.0 (+public-rate-collector)',
          },
          signal: AbortSignal.timeout(timeout),
        });
      }
    }
    if (!response.ok)
      throw new Error(`Source fetch failed with HTTP ${response.status}`);
    const rawContent = await response.text();
    const content = this.prepareContent(rawContent, maxCharacters);
    if (!content) throw new Error('Source returned empty content');
    return {
      sourceUrl: response.url || url,
      content,
      fetchedAt: new Date(),
      discoveredCurrencies: this.discoverCurrencies(rawContent),
      sourceTimestampIndicatesFreshness:
        this.sourceTimestampIndicatesFreshness(),
    };
  }

  protected prepareContent(rawContent: string, maxCharacters: number): string {
    return cleanPublicPage(rawContent, maxCharacters);
  }

  protected discoverCurrencies(
    rawContent: string,
  ): FetchedSourceContent['discoveredCurrencies'] {
    void rawContent;
    return undefined;
  }

  protected sourceTimestampIndicatesFreshness(): boolean {
    return true;
  }

  protected fallbackUrl(url: string, status: number): string | undefined {
    void url;
    void status;
    return undefined;
  }
}
