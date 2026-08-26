import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SourcesModule } from '../sources/sources.module';
import { CollectionSchedulerService } from './collection-scheduler.service';
import { CurrencyCollectorService } from './currency-collector.service';
import { RateAggregationService } from './rate-aggregation.service';
import { RateNormalizationService } from './rate-normalization.service';

@Module({
  imports: [AiModule, SourcesModule],
  providers: [
    CurrencyCollectorService,
    RateAggregationService,
    RateNormalizationService,
    CollectionSchedulerService,
  ],
  exports: [
    CurrencyCollectorService,
    CollectionSchedulerService,
    RateAggregationService,
    RateNormalizationService,
  ],
})
export class CollectionModule {}
