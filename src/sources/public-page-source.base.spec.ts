import { ConfigService } from '@nestjs/config';
import { PublicPageSource } from './public-page-source.base';

class TestSource extends PublicPageSource {
  readonly slug = 'test';
}

describe('PublicPageSource', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fails cleanly when the public website fetch fails', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network unavailable'));
    const source = new TestSource(new ConfigService());
    await expect(source.fetchContent('https://example.test')).rejects.toThrow(
      'network unavailable',
    );
  });
});
