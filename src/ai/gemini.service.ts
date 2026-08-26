import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateBatchExtraction } from './ai-extraction.validator';
import { AiBatchExtractionInput, AiBatchExtractionResult } from './ai.types';

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    rates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          currency: { type: 'string' },
          base: { type: 'string', enum: ['SYP'] },
          buy: { type: 'number' },
          sell: { type: 'number' },
          unit: { type: 'string', enum: ['OLD_SYP', 'NEW_SYP'] },
          sourceUpdatedAt: { type: ['string', 'null'] },
          confidence: { type: 'number' },
        },
        required: [
          'currency',
          'base',
          'buy',
          'sell',
          'unit',
          'sourceUpdatedAt',
          'confidence',
        ],
      },
    },
    notFound: { type: 'array', items: { type: 'string' } },
  },
  required: ['rates', 'notFound'],
} as const;

const SYSTEM_PROMPT = `You are a financial data extraction engine.
Extract exchange rates ONLY from the supplied source content.
Never use your own knowledge. Never estimate missing numbers. Never fabricate rates.
Extract only explicitly displayed buy and sell values in the configured denomination.
If a requested currency does not have both buy and sell values, put its code in notFound.
Only return a rate when both buy and sell are finite numbers strictly greater than zero.
Do not calculate a missing buy or sell value from a mid rate.
Return valid JSON matching the supplied schema only.`;

@Injectable()
export class GeminiService {
  private readonly logger = new Logger('Gemini');

  constructor(private readonly config: ConfigService) {}

  async extractRates(
    input: AiBatchExtractionInput,
  ): Promise<AiBatchExtractionResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const model = this.config.get<string>(
      'GEMINI_MODEL',
      'gemini-3.1-flash-lite',
    );
    const baseUrl = this.config
      .get<string>(
        'GEMINI_BASE_URL',
        'https://generativelanguage.googleapis.com/v1beta',
      )
      .replace(/\/$/, '');
    const timeout = Number(this.config.get('GEMINI_TIMEOUT_MS') ?? 30_000);
    const maxOutputTokens = Number(
      this.config.get('GEMINI_MAX_OUTPUT_TOKENS') ?? 4_096,
    );

    this.logger.log(
      `Extracting ${input.currencies.length} currencies from ${input.sourceName}...`,
    );
    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Source: ${input.sourceName}\nRequested currencies: ${input.currencies.join(', ')}\nBase currency: SYP\nConfigured source denomination: ${input.expectedUnit}\n\n<source_content>\n${input.content}\n</source_content>`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseJsonSchema: EXTRACTION_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(timeout),
      },
    );

    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(`Gemini request failed (${response.status}): ${details}`);
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content)
      throw new Error('Gemini response did not contain JSON content');

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Gemini returned invalid JSON');
    }
    const extraction = validateBatchExtraction(
      parsed,
      input.currencies,
      'Gemini',
    );
    this.logger.log(
      `${extraction.rates.length} rates extracted from ${input.sourceName}`,
    );
    return extraction;
  }
}
