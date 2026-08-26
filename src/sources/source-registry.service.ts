import { Injectable } from '@nestjs/common';
import { CurrencySourceAdapter } from './currency-source.interface';
import { SpTodaySource } from './sp-today/sp-today.source';
import { SypNowSource } from './syp-now/syp-now.source';

@Injectable()
export class SourceRegistryService {
  private readonly adapters: Map<string, CurrencySourceAdapter>;

  constructor(spToday: SpTodaySource, sypNow: SypNowSource) {
    this.adapters = new Map(
      [spToday, sypNow].map((adapter) => [adapter.slug, adapter]),
    );
  }

  get(slug: string): CurrencySourceAdapter | undefined {
    return this.adapters.get(slug);
  }
}
