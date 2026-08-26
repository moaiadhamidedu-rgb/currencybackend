import { Controller, Get, Param } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';

@Controller('api/v1/rates')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  getRates() {
    return this.currenciesService.getRates();
  }

  @Get(':currency')
  getRate(@Param('currency') currency: string) {
    return this.currenciesService.getRate(currency);
  }
}
