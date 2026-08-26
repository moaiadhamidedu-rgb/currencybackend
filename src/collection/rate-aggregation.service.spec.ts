import { RateAggregationService } from './rate-aggregation.service';

describe('RateAggregationService', () => {
  const service = new RateAggregationService();

  it('calculates independent buy and sell medians', () => {
    const result = service.aggregate(
      [
        { id: 1, buy: 132.5, sell: 133, aiConfidence: 0.9 },
        { id: 2, buy: 132.4, sell: 132.9, aiConfidence: 0.9 },
        { id: 3, buy: 132.45, sell: 132.95, aiConfidence: 0.9 },
      ],
      3,
    );
    expect(result).toMatchObject({ buy: 132.45, sell: 132.95, outlierIds: [] });
  });

  it('rejects an outlier beyond the configured threshold', () => {
    const result = service.aggregate(
      [
        { id: 1, buy: 132.5, sell: 133, aiConfidence: 0.9 },
        { id: 2, buy: 132.4, sell: 132.9, aiConfidence: 0.9 },
        { id: 3, buy: 145, sell: 146, aiConfidence: 0.9 },
      ],
      3,
    );
    expect(result?.outlierIds).toEqual([3]);
    expect(result?.buy).toBe(132.45);
    expect(result?.sell).toBe(132.95);
  });

  it('refuses to publish two sources that disagree beyond the threshold', () => {
    expect(
      service.aggregate(
        [
          { id: 1, buy: 132, sell: 132.5, aiConfidence: 1 },
          { id: 2, buy: 13_200, sell: 13_250, aiConfidence: 1 },
        ],
        3,
      ),
    ).toBeNull();
  });
});
