import { validateBatchExtraction } from './ai-extraction.validator';

describe('validateBatchExtraction', () => {
  it('treats omitted requested currencies as not found', () => {
    expect(
      validateBatchExtraction({ rates: [], notFound: [] }, ['USD'], 'AI'),
    ).toEqual({ rates: [], notFound: ['USD'] });
  });

  it('rejects duplicate currency results', () => {
    const rate = {
      currency: 'USD',
      base: 'SYP',
      buy: 100,
      sell: 101,
      unit: 'NEW_SYP',
      sourceUpdatedAt: null,
      confidence: 0.9,
    };
    expect(() =>
      validateBatchExtraction(
        { rates: [rate, rate], notFound: [] },
        ['USD'],
        'AI',
      ),
    ).toThrow('duplicate USD');
  });
});
