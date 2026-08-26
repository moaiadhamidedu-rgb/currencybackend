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
});
