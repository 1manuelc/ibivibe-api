import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MediasService } from './medias.service';

@Module({
	imports: [ConfigModule],
	providers: [MediasService],
	exports: [MediasService],
})
export class MediasModule {}
