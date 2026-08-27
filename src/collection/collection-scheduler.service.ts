import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrencyCollectorService } from './currency-collector.service';

@Injectable()
export class CollectionSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('CollectionScheduler');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly collector: CurrencyCollectorService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const interval = Number(
      this.config.get('COLLECTION_INTERVAL_MS') ?? 1_800_000,
    );
    if (interval <= 0) {
      this.logger.warn('Automatic currency collection is disabled');
      return;
    }
    this.timer = setInterval(() => {
      void this.collectSafely();
    }, interval);
    this.timer.unref();
    this.logger.log(`Currency collection scheduled every ${interval}ms`);

    const collectOnStartup =
      this.config.get<string>('COLLECT_ON_STARTUP')?.toLowerCase() === 'true';
    if (collectOnStartup) {
      this.logger.log('Initial currency collection requested at startup');
      void this.collectSafely();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  refreshNow() {
    return this.collector.collect();
  }

  private async collectSafely(): Promise<void> {
    try {
      await this.collector.collect();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
