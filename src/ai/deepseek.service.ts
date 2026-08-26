import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepSeekExtraction, SypUnit } from './deepseek.types';

const SYSTEM_PROMPT = `You are a financial data extraction engine.
Extract exchange rates ONLY from the supplied source content.
Never use your own knowledge. Never estimate missing numbers. Never fabricate rates.
If the requested rate cannot be found in the supplied content, return {"found":false}.
Identify currency, buy, sell, source timestamp when available, and OLD_SYP or NEW_SYP.
Return one valid JSON object only, with no markdown or explanatory text.`;

@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger('DeepSeek');

  constructor(private readonly config: ConfigService) {}

  async extractRate(input: {
    sourceName: string;
    currency: string;
    expectedUnit: SypUnit;
    content: string;
  }): Promise<DeepSeekExtraction> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const model = this.config.get<string>(
      'DEEPSEEK_MODEL',
      'deepseek-v4-flash',
    );
    const baseUrl = this.config
      .get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
      .replace(/\/$/, '');
    const timeoutMs = Number(this.config.get('DEEPSEEK_TIMEOUT_MS') ?? 30_000);
    const maxTokens = Number(this.config.get('DEEPSEEK_MAX_TOKENS') ?? 500);

    this.logger.log(
      `Extracting ${input.currency}/SYP from ${input.sourceName}...`,
    );
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Source: ${input.sourceName}\nCurrency requested: ${input.currency}\nBase currency: SYP\nConfigured source denomination: ${input.expectedUnit}\nExtract the values in that configured denomination.\n\n<source_content>\n${input.content}\n</source_content>`,
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 300);
      throw new Error(
        `DeepSeek request failed (${response.status}): ${details}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content)
      throw new Error('DeepSeek response did not contain JSON content');

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('DeepSeek returned invalid JSON');
    }

    const extraction = this.validateExtraction(parsed, input.currency);
    if (extraction.found) {
      this.logger.log(`${input.currency} extracted successfully`);
    }
    return extraction;
  }

  private validateExtraction(
    value: unknown,
    requestedCurrency: string,
  ): DeepSeekExtraction {
    if (!value || typeof value !== 'object') {
      throw new Error('DeepSeek extraction must be a JSON object');
    }
    const result = value as Record<string, unknown>;
    if (result.found === false) return { found: false };
    const currency =
      typeof result.currency === 'string' ? result.currency.toUpperCase() : '';
    const buy = Number(result.buy);
    const sell = Number(result.sell);
    const confidence = Number(result.confidence);
    const unit = result.unit;
    if (
      result.found !== true ||
      currency !== requestedCurrency.toUpperCase() ||
      result.base !== 'SYP' ||
      !Number.isFinite(buy) ||
      !Number.isFinite(sell) ||
      buy <= 0 ||
      sell <= 0 ||
      sell < buy ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1 ||
      (unit !== 'OLD_SYP' && unit !== 'NEW_SYP')
    ) {
      throw new Error('DeepSeek returned an invalid extraction shape');
    }
    const timestamp = result.sourceUpdatedAt;
    if (
      timestamp !== null &&
      timestamp !== undefined &&
      typeof timestamp !== 'string'
    ) {
      throw new Error('DeepSeek returned an invalid source timestamp');
    }
    return {
      found: true,
      currency,
      base: 'SYP',
      buy,
      sell,
      unit,
      sourceUpdatedAt: timestamp ?? null,
      confidence,
    };
  }
}
