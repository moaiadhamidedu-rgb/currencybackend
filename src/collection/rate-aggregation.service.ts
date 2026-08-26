import { Injectable } from '@nestjs/common';

export interface AggregationObservation {
  id: number;
  buy: number;
  sell: number;
  aiConfidence: number | null;
}

export interface AggregationResult {
  buy: number;
  sell: number;
  mid: number;
  confidence: number;
  acceptedIds: number[];
  outlierIds: number[];
}

@Injectable()
export class RateAggregationService {
  aggregate(
    observations: AggregationObservation[],
    thresholdPercent: number,
  ): AggregationResult | null {
    if (observations.length === 0) return null;

    const initialBuy = this.median(observations.map((item) => item.buy));
    const initialSell = this.median(observations.map((item) => item.sell));
    const threshold = thresholdPercent / 100;
    if (
      observations.length === 2 &&
      (this.deviation(observations[0].buy, observations[1].buy) > threshold ||
        this.deviation(observations[0].sell, observations[1].sell) > threshold)
    ) {
      return null;
    }
    const accepted =
      observations.length < 3
        ? observations
        : observations.filter(
            (item) =>
              this.deviation(item.buy, initialBuy) <= threshold &&
              this.deviation(item.sell, initialSell) <= threshold,
          );

    if (accepted.length === 0) return null;
    const acceptedIds = new Set(accepted.map((item) => item.id));
    const buy = this.median(accepted.map((item) => item.buy));
    const sell = this.median(accepted.map((item) => item.sell));
    const sourceScore =
      accepted.length >= 3 ? 0.9 : accepted.length === 2 ? 0.7 : 0.45;
    const aiScores = accepted
      .map((item) => item.aiConfidence)
      .filter((score): score is number => score !== null);
    const aiScore = aiScores.length
      ? aiScores.reduce((sum, score) => sum + score, 0) / aiScores.length
      : sourceScore;

    return {
      buy,
      sell,
      mid: (buy + sell) / 2,
      confidence: Math.min(1, sourceScore * 0.7 + aiScore * 0.3),
      acceptedIds: [...acceptedIds],
      outlierIds: observations
        .filter((item) => !acceptedIds.has(item.id))
        .map((item) => item.id),
    };
  }

  median(values: number[]): number {
    if (values.length === 0)
      throw new Error('Cannot calculate median of an empty set');
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

  private deviation(value: number, reference: number): number {
    return reference === 0
      ? Number.POSITIVE_INFINITY
      : Math.abs(value - reference) / reference;
  }
}
