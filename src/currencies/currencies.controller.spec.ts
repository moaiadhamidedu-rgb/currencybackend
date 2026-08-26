import { Test } from '@nestjs/testing';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';

describe('CurrenciesController', () => {
  const service = {
    getRates: jest.fn(),
    getRate: jest.fn(),
  };

  let controller: CurrenciesController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CurrenciesController],
      providers: [{ provide: CurrenciesService, useValue: service }],
    }).compile();
    controller = module.get(CurrenciesController);
  });

  it('delegates the rates list to the service', async () => {
    service.getRates.mockResolvedValue({ success: true, rates: [] });
    await expect(controller.getRates()).resolves.toEqual({
      success: true,
      rates: [],
    });
  });

  it('delegates a normalized lookup to the service', async () => {
    service.getRate.mockResolvedValue({ success: true });
    await controller.getRate('usd');
    expect(service.getRate).toHaveBeenCalledWith('usd');
  });
});
