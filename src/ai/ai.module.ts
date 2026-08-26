import { Module } from '@nestjs/common';
import { AiExtractionService } from './ai-extraction.service';
import { DeepSeekService } from './deepseek.service';
import { GeminiService } from './gemini.service';

@Module({
  providers: [AiExtractionService, DeepSeekService, GeminiService],
  exports: [AiExtractionService],
})
export class AiModule {}
