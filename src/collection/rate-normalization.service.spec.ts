import { RateNormalizationService } from './rate-normalization.service';

describe('RateNormalizationService', () => {
  it('normalizes a configured OLD_SYP source to NEW_SYP', () => {
    const service = new RateNormalizationService();
    expect(service.normalize(13250, 13300, 0.01)).toEqual({
      buy: 132.5,
      sell: 133,
      mid: 132.75,
    });
  });
});
