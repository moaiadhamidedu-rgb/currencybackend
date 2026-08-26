import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async getRates() {
    const publishedRates = await this.prisma.publishedRate.findMany({
      where: { currency: { enabled: true } },
      include: { currency: true },
      orderBy: { currency: { code: 'asc' } },
    });

    const updatedAt = publishedRates.reduce<Date | null>(
      (latest, rate) =>
        !latest || rate.updatedAt > latest ? rate.updatedAt : latest,
      null,
    );

    return {
      success: true,
      base: 'SYP',
      denomination: 'new',
      updatedAt: updatedAt?.toISOString() ?? null,
      rates: publishedRates.map((rate) => this.toPublicRate(rate)),
    };
  }

  async getRate(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const rate = await this.prisma.publishedRate.findFirst({
      where: { currency: { code: normalizedCode, enabled: true } },
      include: { currency: true },
    });

    if (!rate) {
      throw new NotFoundException(
        `No published rate found for ${normalizedCode}`,
      );
    }

    return {
      success: true,
      base: 'SYP',
      denomination: 'new',
      updatedAt: rate.updatedAt.toISOString(),
      rate: this.toPublicRate(rate),
    };
  }

  private toPublicRate(rate: {
    buy: number;
    sell: number;
    status: string;
    confidence: number;
    currency: { code: string; name: string };
  }) {
    return {
      currency: rate.currency.code,
      name: rate.currency.name,
      buy: this.round(rate.buy),
      sell: this.round(rate.sell),
      status: rate.status.toLowerCase(),
      confidence: this.confidenceLabel(rate.confidence),
    };
  }

  private confidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.55) return 'medium';
    return 'low';
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
  }
}
