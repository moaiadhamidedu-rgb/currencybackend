import {
  extractSpTodayOldSypRates,
  parseSpTodayCurrencyDataset,
} from './sp-today.source';

describe('extractSpTodayOldSypRates', () => {
  it('labels embedded public buy and sell values as OLD_SYP', () => {
    const html = String.raw`\"currencies\":[{\"code\":\"USD\",\"cities\":{\"damascus\":{\"buy\":13200,\"sell\":13250,\"change\":0}},\"updated_at\":\"2026-08-26T11:27:01+03:00\"}]`;
    expect(extractSpTodayOldSypRates(html)).toContain(
      'currency=USD base=SYP denomination=OLD_SYP buy=13200 sell=13250 sourceUpdatedAt=2026-08-26T11:27:01+03:00',
    );
  });

  it('fails instead of sending ambiguous fallback content', () => {
    expect(() => extractSpTodayOldSypRates('<html>changed</html>')).toThrow(
      'did not contain its currency dataset',
    );
  });

  it('discovers every embedded currency including one with a zero quote', () => {
    const html = String.raw`\"currencies\":[{\"code\":\"USD\",\"cities\":{\"damascus\":{\"buy\":13200,\"sell\":13250}},\"updated_at\":\"2026-08-26T11:27:01+03:00\"},{\"code\":\"IRR\",\"cities\":{\"damascus\":{\"buy\":0,\"sell\":0}},\"updated_at\":\"2026-08-26T11:27:01+03:00\"}]`;

    expect(parseSpTodayCurrencyDataset(html)).toEqual([
      {
        code: 'USD',
        buy: 13200,
        sell: 13250,
        updatedAt: '2026-08-26T11:27:01+03:00',
      },
      {
        code: 'IRR',
        buy: 0,
        sell: 0,
        updatedAt: '2026-08-26T11:27:01+03:00',
      },
    ]);
  });

  it('parses OLD_SYP values from the markdown fallback', () => {
    const markdown = `| [USD دولار أمريكي](http://sp-today.com/currency/us-dollar) | 132.00 13,200 قديمة | 132.50 13,250 قديمة | 0.00% | 132.00 | 132.00 | عرض |
| [EUR يورو](http://sp-today.com/currency/euro) | 152.60 15,260 قديمة | 154.40 15,440 قديمة | 0.00% | 152.60 | 152.60 | عرض |`;

    expect(parseSpTodayCurrencyDataset(markdown)).toEqual([
      { code: 'USD', buy: 13200, sell: 13250, updatedAt: null },
      { code: 'EUR', buy: 15260, sell: 15440, updatedAt: null },
    ]);
    expect(extractSpTodayOldSypRates(markdown)).toContain(
      'currency=USD base=SYP denomination=OLD_SYP buy=13200 sell=13250 sourceUpdatedAt=null',
    );
  });
});
