export type SypUnit = 'OLD_SYP' | 'NEW_SYP';

export type DeepSeekExtraction =
  | { found: false }
  | {
      found: true;
      currency: string;
      base: 'SYP';
      buy: number;
      sell: number;
      unit: SypUnit;
      sourceUpdatedAt: string | null;
      confidence: number;
    };
