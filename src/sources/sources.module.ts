import { Module } from '@nestjs/common';
import { SourceRegistryService } from './source-registry.service';
import { SpTodaySource } from './sp-today/sp-today.source';
import { SypNowSource } from './syp-now/syp-now.source';

@Module({
  providers: [SpTodaySource, SypNowSource, SourceRegistryService],
  exports: [SourceRegistryService],
})
export class SourcesModule {}
