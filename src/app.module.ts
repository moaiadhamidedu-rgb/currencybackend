import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrenciesModule } from './currencies/currencies.module';
import { PrismaModule } from './prisma/prisma.module';
import { CollectionModule } from './collection/collection.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CurrenciesModule,
    CollectionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
