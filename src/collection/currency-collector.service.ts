import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiExtractionService } from '../ai/ai-extraction.service';
import { PrismaService } from '../prisma/prisma.service';
import { SourceRegistryService } from '../sources/source-registry.service';
import { RateAggregationService } from './rate-aggregation.service';
import { RateNormalizationService } from './rate-normalization.service';

@Injectable()
export class CurrencyCollectorService {
  private readonly logger = new Logger('CurrencyCollector');
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: SourceRegistryService,
    private readonly ai: AiExtractionService,
    private readonly aggregation: RateAggregationService,
    private readonly normalization: RateNormalizationService,
    private readonly config: ConfigService,
  ) {}

  async collect(): Promise<{ runId: number; status: string }> {
    if (this.running)
      throw new Error('A currency collection run is already in progress');
    this.running = true;
    const run = await this.prisma.collectionRun.create({ data: {} });
    const errors: string[] = [];
    let sourceSuccesses = 0;
    let sourceFailures = 0;

    try {
      const [initialCurrencies, configuredSources] = await Promise.all([
        this.prisma.currency.findMany({
          where: { enabled: true },
          orderBy: { code: 'asc' },
        }),
        this.prisma.currencySource.findMany({
          where: { enabled: true },
          orderBy: { priority: 'asc' },
        }),
      ]);
      let currencies = initialCurrencies;

      for (const source of configuredSources) {
        const adapter = this.sources.get(source.slug);
        if (!adapter) {
          sourceFailures++;
          errors.push(`${source.slug}: no registered adapter`);
          await this.recordSourceFailure(
            source.id,
            'No registered source adapter',
          );
          continue;
        }

        this.logger.log(`Fetching ${source.name}...`);
        try {
          const fetched = await adapter.fetchContent(source.url);
          this.logger.log(`${source.name} fetched successfully`);
          if (fetched.discoveredCurrencies?.length) {
            const created = await this.syncDiscoveredCurrencies(
              fetched.discoveredCurrencies,
            );
            currencies = await this.prisma.currency.findMany({
              where: { enabled: true },
              orderBy: { code: 'asc' },
            });
            this.logger.log(
              `${source.name} discovered ${fetched.discoveredCurrencies.length} currencies (${created} new)`,
            );
          }
          const positiveDiscoveredCodes = fetched.discoveredCurrencies
            ? new Set(
                fetched.discoveredCurrencies
                  .filter((currency) => currency.hasPositiveRate)
                  .map((currency) => currency.code),
              )
            : null;
          const requestedCurrencies = currencies.filter(
            (currency) =>
              !positiveDiscoveredCodes ||
              positiveDiscoveredCodes.has(currency.code),
          );
          const extraction = await this.ai.extractRates({
            sourceName: source.name,
            currencies: requestedCurrencies.map((currency) => currency.code),
            expectedUnit: source.denomination,
            content: fetched.content,
          });
          sourceSuccesses++;
          await this.prisma.currencySource.update({
            where: { id: source.id },
            data: { lastSuccessAt: fetched.fetchedAt, lastError: null },
          });

          const currenciesByCode = new Map(
            currencies.map((currency) => [currency.code, currency]),
          );
          const contentHash = createHash('sha256')
            .update(fetched.content)
            .digest('hex');
          for (const extracted of extraction.rates) {
            const currency = currenciesByCode.get(extracted.currency);
            if (!currency) continue;
            try {
              const sourceUpdatedAt = this.parseDate(extracted.sourceUpdatedAt);
              const stale =
                fetched.sourceTimestampIndicatesFreshness !== false &&
                this.isStale(sourceUpdatedAt, fetched.fetchedAt);
              const denominationMismatch =
                extracted.unit !== source.denomination;
              const normalized = this.normalization.normalize(
                extracted.buy,
                extracted.sell,
                source.normalizationFactor,
              );
              const status =
                stale || denominationMismatch ? 'REJECTED' : 'VALID';
              const excerpt = this.relevantExcerpt(
                fetched.content,
                currency.code,
              );

              await this.prisma.rateObservation.create({
                data: {
                  currencyId: currency.id,
                  sourceId: source.id,
                  collectionRunId: run.id,
                  buy: normalized.buy,
                  sell: normalized.sell,
                  mid: normalized.mid,
                  sourceDenomination: source.denomination,
                  sourceUpdatedAt,
                  fetchedAt: fetched.fetchedAt,
                  sourceUrl: fetched.sourceUrl,
                  rawContentHash: contentHash,
                  relevantExcerpt: excerpt,
                  extractionJson: JSON.stringify(extracted),
                  aiConfidence: extracted.confidence,
                  status,
                  rejectionReason: stale
                    ? 'Source observation is stale'
                    : denominationMismatch
                      ? 'AI denomination conflicts with source configuration'
                      : null,
                },
              });
            } catch (error) {
              const message = this.errorMessage(error);
              errors.push(`${source.slug}/${currency.code}: ${message}`);
              this.logger.error(`${source.name}/${currency.code}: ${message}`);
            }
          }
        } catch (error) {
          sourceFailures++;
          const message = this.errorMessage(error);
          errors.push(`${source.slug}: ${message}`);
          this.logger.error(`${source.name} failed: ${message}`);
          await this.recordSourceFailure(source.id, message);
        }
      }

      await this.publishRun(
        run.id,
        currencies.map((currency) => currency.id),
      );
      const status =
        configuredSources.length > 0 &&
        sourceFailures === configuredSources.length
          ? 'FAILED'
          : sourceFailures > 0 || errors.length > 0
            ? 'PARTIAL'
            : 'COMPLETED';
      await this.prisma.collectionRun.update({
        where: { id: run.id },
        data: {
          status,
          completedAt: new Date(),
          sourceCount: configuredSources.length,
          successCount: sourceSuccesses,
          failureCount: sourceFailures,
          errorSummary: errors.length
            ? errors.slice(0, 20).join('\n').slice(0, 4000)
            : null,
        },
      });
      return { runId: run.id, status };
    } catch (error) {
      await this.prisma.collectionRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorSummary: this.errorMessage(error).slice(0, 4000),
        },
      });
      throw error;
    } finally {
      this.running = false;
    }
  }

  private async publishRun(
    runId: number,
    currencyIds: number[],
  ): Promise<void> {
    const threshold = Number(this.config.get('OUTLIER_THRESHOLD_PERCENT') ?? 3);
    for (const currencyId of currencyIds) {
      const observations = await this.prisma.rateObservation.findMany({
        where: { collectionRunId: runId, currencyId, status: 'VALID' },
      });
      const result = this.aggregation.aggregate(observations, threshold);
      if (!result) {
        await this.prisma.publishedRate.updateMany({
          where: { currencyId },
          data: { status: 'STALE' },
        });
        continue;
      }

      if (result.outlierIds.length) {
        await this.prisma.rateObservation.updateMany({
          where: { id: { in: result.outlierIds } },
          data: {
            status: 'OUTLIER',
            rejectionReason: 'Outside configured median threshold',
          },
        });
      }
      await this.prisma.$transaction([
        this.prisma.rateCalculation.create({
          data: {
            currencyId,
            collectionRunId: runId,
            medianBuy: result.buy,
            medianSell: result.sell,
            acceptedObservations: result.acceptedIds.length,
            rejectedOutliers: result.outlierIds.length,
            confidence: result.confidence,
          },
        }),
        this.prisma.publishedRate.upsert({
          where: { currencyId },
          create: {
            currencyId,
            buy: result.buy,
            sell: result.sell,
            mid: result.mid,
            confidence: result.confidence,
            status: 'FRESH',
          },
          update: {
            buy: result.buy,
            sell: result.sell,
            mid: result.mid,
            confidence: result.confidence,
            status: 'FRESH',
            publishedAt: new Date(),
          },
        }),
      ]);
      this.logger.log(`Published currency ${currencyId} updated successfully`);
    }
  }

  private async recordSourceFailure(
    sourceId: number,
    message: string,
  ): Promise<void> {
    await this.prisma.currencySource.update({
      where: { id: sourceId },
      data: { lastFailureAt: new Date(), lastError: message.slice(0, 1000) },
    });
  }

  private async syncDiscoveredCurrencies(
    discovered: Array<{
      code: string;
      name: string;
      symbol?: string;
    }>,
  ): Promise<number> {
    const normalized = new Map(
      discovered.map((currency) => [
        currency.code.trim().toUpperCase(),
        currency,
      ]),
    );
    const existing = await this.prisma.currency.findMany({
      where: { code: { in: [...normalized.keys()] } },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((currency) => currency.code));
    const missing = [...normalized.entries()].filter(
      ([code]) => !existingCodes.has(code),
    );
    for (const [code, currency] of missing) {
      await this.prisma.currency.create({
        data: {
          code,
          name: currency.name || code,
          symbol: currency.symbol || code,
        },
      });
    }
    return missing.length;
  }

  private isStale(sourceDate: Date | null, fetchedAt: Date): boolean {
    if (!sourceDate) return false;
    const maxAgeMinutes = Number(
      this.config.get('OBSERVATION_MAX_AGE_MINUTES') ?? 90,
    );
    return fetchedAt.getTime() - sourceDate.getTime() > maxAgeMinutes * 60_000;
  }

  private parseDate(value: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private relevantExcerpt(content: string, currency: string): string {
    const index = content.toUpperCase().indexOf(currency.toUpperCase());
    if (index < 0) return content.slice(0, 1000);
    return content.slice(Math.max(0, index - 300), index + 700);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
