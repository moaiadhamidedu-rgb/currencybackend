import { ConfigService } from '@nestjs/config';
import { AiExtractionService } from '../ai/ai-extraction.service';
import { PrismaService } from '../prisma/prisma.service';
import { SourceRegistryService } from '../sources/source-registry.service';
import { CurrencyCollectorService } from './currency-collector.service';
import { RateAggregationService } from './rate-aggregation.service';
import { RateNormalizationService } from './rate-normalization.service';

describe('CurrencyCollectorService failure handling', () => {
  function createHarness() {
    type ObservationInput = {
      data: { status: string; rejectionReason: string | null };
    };
    let createdObservation: ObservationInput | undefined;
    const prisma = {
      collectionRun: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      currency: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 10, code: 'USD', name: 'US Dollar', enabled: true },
          ]),
      },
      currencySource: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 20,
            name: 'SP Today',
            slug: 'sp-today',
            url: 'https://example.test',
            denomination: 'NEW_SYP',
            normalizationFactor: 1,
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      rateObservation: {
        create: jest.fn((args: ObservationInput) => {
          createdObservation = args;
          return Promise.resolve({});
        }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      publishedRate: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
      },
      rateCalculation: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const adapter = { fetchContent: jest.fn() };
    const registry = { get: jest.fn().mockReturnValue(adapter) };
    const ai = { extractRates: jest.fn() };
    const service = new CurrencyCollectorService(
      prisma as unknown as PrismaService,
      registry as unknown as SourceRegistryService,
      ai as unknown as AiExtractionService,
      new RateAggregationService(),
      new RateNormalizationService(),
      new ConfigService({ OUTLIER_THRESHOLD_PERCENT: 3 }),
    );
    return {
      service,
      prisma,
      adapter,
      ai,
      getCreatedObservation: () => createdObservation,
    };
  }

  it('preserves the last published rate as stale when every source fails', async () => {
    const { service, prisma, adapter } = createHarness();
    adapter.fetchContent.mockRejectedValue(new Error('website unavailable'));

    await expect(service.collect()).resolves.toEqual({
      runId: 1,
      status: 'FAILED',
    });
    expect(prisma.publishedRate.updateMany).toHaveBeenCalledWith({
      where: { currencyId: 10 },
      data: { status: 'STALE' },
    });
    expect(prisma.publishedRate.upsert).not.toHaveBeenCalled();
  });

  it('rejects a stale observation and keeps the published rate', async () => {
    const { service, prisma, adapter, ai, getCreatedObservation } =
      createHarness();
    adapter.fetchContent.mockResolvedValue({
      sourceUrl: 'https://example.test',
      content: 'USD 132.50 133.00',
      fetchedAt: new Date('2026-08-26T12:00:00Z'),
    });
    ai.extractRates.mockResolvedValue({
      rates: [
        {
          currency: 'USD',
          base: 'SYP',
          buy: 132.5,
          sell: 133,
          unit: 'NEW_SYP',
          sourceUpdatedAt: '2026-08-26T08:00:00Z',
          confidence: 0.9,
        },
      ],
      notFound: [],
    });

    await service.collect();
    expect(getCreatedObservation()?.data.status).toBe('REJECTED');
    expect(getCreatedObservation()?.data.rejectionReason).toBe(
      'Source observation is stale',
    );
    expect(prisma.publishedRate.upsert).not.toHaveBeenCalled();
  });
});
