import { Injectable } from '@nestjs/common';

@Injectable()
export class RateNormalizationService {
  normalize(buy: number, sell: number, normalizationFactor: number) {
    if (![buy, sell, normalizationFactor].every(Number.isFinite)) {
      throw new Error('Rate normalization received a non-finite number');
    }
    if (buy <= 0 || sell <= 0 || sell < buy || normalizationFactor <= 0) {
      throw new Error('Rate normalization received invalid values');
    }
    const normalizedBuy = this.round(buy * normalizationFactor);
    const normalizedSell = this.round(sell * normalizationFactor);
    return {
      buy: normalizedBuy,
      sell: normalizedSell,
      mid: this.round((normalizedBuy + normalizedSell) / 2),
    };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
  }
}
