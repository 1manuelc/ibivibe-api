import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ImageProcessingService } from './image-processing.service';
import { MediasService } from './medias.service';
import { R2StorageService } from './r2-storage.service';

@Module({
	imports: [ConfigModule],
	providers: [MediasService, ImageProcessingService, R2StorageService],
	exports: [MediasService],
})
export class MediasModule {}
