import { SypUnit } from './deepseek.types';

export interface AiBatchExtractionInput {
  sourceName: string;
  currencies: string[];
  expectedUnit: SypUnit;
  content: string;
}

export interface ExtractedRate {
  currency: string;
  base: 'SYP';
  buy: number;
  sell: number;
  unit: SypUnit;
  sourceUpdatedAt: string | null;
  confidence: number;
}

export interface AiBatchExtractionResult {
  rates: ExtractedRate[];
  notFound: string[];
}
