import { ConfigService } from '@nestjs/config';
import { DeepSeekService } from './deepseek.service';

describe('DeepSeekService', () => {
  const config = new ConfigService({
    DEEPSEEK_API_KEY: 'test-key',
    DEEPSEEK_BASE_URL: 'https://example.test',
    DEEPSEEK_MODEL: 'test-model',
    DEEPSEEK_TIMEOUT_MS: 1000,
  });
  const service = new DeepSeekService(config);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rejects invalid JSON returned by DeepSeek', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ choices: [{ message: { content: 'not-json' } }] }),
    });
    await expect(
      service.extractRate({
        sourceName: 'Source',
        currency: 'USD',
        expectedUnit: 'NEW_SYP',
        content: 'page',
      }),
    ).rejects.toThrow('DeepSeek returned invalid JSON');
  });

  it('accepts found=false without inventing a rate', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '{"found":false}' } }],
        }),
    });
    await expect(
      service.extractRate({
        sourceName: 'Source',
        currency: 'USD',
        expectedUnit: 'NEW_SYP',
        content: 'page',
      }),
    ).resolves.toEqual({ found: false });
  });
});
