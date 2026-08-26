import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CurrencyCollectorService } from './currency-collector.service';

async function main(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule);
  try {
    const result = await application.get(CurrencyCollectorService).collect();
    console.log(
      `Collection run ${result.runId} finished with status ${result.status}`,
    );
  } finally {
    await application.close();
  }
}

void main();
