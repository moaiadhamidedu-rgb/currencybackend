import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';

describe('GeminiService', () => {
  const config = new ConfigService({
    GEMINI_API_KEY: 'test-key',
    GEMINI_BASE_URL: 'https://example.test',
    GEMINI_MODEL: 'test-model',
    GEMINI_TIMEOUT_MS: 1000,
  });
  const service = new GeminiService(config);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('extracts a validated currency batch from structured JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      rates: [
                        {
                          currency: 'USD',
                          base: 'SYP',
                          buy: 132.5,
                          sell: 133,
                          unit: 'NEW_SYP',
                          sourceUpdatedAt: null,
                          confidence: 0.95,
                        },
                      ],
                      notFound: ['EUR'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });

    await expect(
      service.extractRates({
        sourceName: 'SP Today',
        currencies: ['USD', 'EUR'],
        expectedUnit: 'NEW_SYP',
        content: 'USD 132.5 133',
      }),
    ).resolves.toEqual({
      rates: [
        {
          currency: 'USD',
          base: 'SYP',
          buy: 132.5,
          sell: 133,
          unit: 'NEW_SYP',
          sourceUpdatedAt: null,
          confidence: 0.95,
        },
      ],
      notFound: ['EUR'],
    });
  });

  it('rejects invalid JSON instead of inventing rates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'not-json' }] } }],
        }),
    });
    await expect(
      service.extractRates({
        sourceName: 'SP Today',
        currencies: ['USD'],
        expectedUnit: 'NEW_SYP',
        content: 'page',
      }),
    ).rejects.toThrow('Gemini returned invalid JSON');
  });
});
