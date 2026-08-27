import { normalizeSpTodayRates, parseSpTodayRates } from './sp-today';

describe('Cloudflare SP Today collector', () => {
  it('parses markdown fallback and ignores zero prices', () => {
    const markdown = `| [USD دولار أمريكي](http://sp-today.com/currency/us-dollar) | 132.00 13,200 قديمة | 132.50 13,250 قديمة | 0.00% | 132.00 | 132.00 | عرض |
| [EUR يورو](http://sp-today.com/currency/euro) | 152.60 15,260 قديمة | 154.40 15,440 قديمة | 0.00% | 152.60 | 152.60 | عرض |
| [IRR ريال إيراني](http://sp-today.com/currency/iranian-rial) | 0.00 0 قديمة | 0.00 0 قديمة | 0.00% | 0.00 | 0.00 | عرض |`;

    expect(parseSpTodayRates(markdown).map((rate) => rate.code)).toEqual([
      'USD',
      'EUR',
    ]);
  });

  it('normalizes old SYP into new SYP deterministically', () => {
    const [rate] = normalizeSpTodayRates([
      {
        code: 'USD',
        buy: 13200,
        sell: 13250,
        sourceUpdatedAt: null,
      },
    ]);
    expect(rate.normalizedBuy).toBe(132);
    expect(rate.normalizedSell).toBe(132.5);
    expect(rate.normalizedMid).toBe(132.25);
  });

  it('rejects changed source content', () => {
    expect(() => parseSpTodayRates('<html>changed</html>')).toThrow(
      'did not contain currency rates',
    );
  });
});
