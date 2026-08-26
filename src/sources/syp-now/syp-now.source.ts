import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicPageSource } from '../public-page-source.base';

@Injectable()
export class SypNowSource extends PublicPageSource {
  readonly slug = 'syp-now';

  constructor(config: ConfigService) {
    super(config);
  }
}
