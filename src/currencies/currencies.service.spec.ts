import { CurrenciesService } from './currencies.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CurrenciesService', () => {
  const prisma = {
    publishedRate: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const service = new CurrenciesService(prisma as unknown as PrismaService);

  it('returns an empty database-backed response when nothing is published', async () => {
    prisma.publishedRate.findMany.mockResolvedValue([]);
    await expect(service.getRates()).resolves.toMatchObject({
      success: true,
      updatedAt: null,
      rates: [],
    });
  });
});
