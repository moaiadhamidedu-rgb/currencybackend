import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiBatchExtractionInput,
  AiBatchExtractionResult,
  ExtractedRate,
} from './ai.types';
import { DeepSeekService } from './deepseek.service';
import { GeminiService } from './gemini.service';

@Injectable()
export class AiExtractionService {
  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiService,
    private readonly deepSeek: DeepSeekService,
  ) {}

  async extractRates(
    input: AiBatchExtractionInput,
  ): Promise<AiBatchExtractionResult> {
    const provider = this.config
      .get<string>('AI_PROVIDER', 'gemini')
      .toLowerCase();
    if (provider === 'gemini') return this.gemini.extractRates(input);
    if (provider === 'deepseek') return this.extractWithDeepSeek(input);
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }

  private async extractWithDeepSeek(
    input: AiBatchExtractionInput,
  ): Promise<AiBatchExtractionResult> {
    const rates: ExtractedRate[] = [];
    const notFound: string[] = [];
    for (const currency of input.currencies) {
      const extracted = await this.deepSeek.extractRate({
        sourceName: input.sourceName,
        currency,
        expectedUnit: input.expectedUnit,
        content: input.content,
      });
      if (extracted.found) rates.push(extracted);
      else notFound.push(currency);
    }
    return { rates, notFound };
  }
}
