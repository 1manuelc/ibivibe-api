import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import { ImageProcessingService } from './image-processing.service';

describe('ImageProcessingService', () => {
	const service = new ImageProcessingService();

	it('validates binary image data and converts it to optimized WebP', async () => {
		const source = await sharp({
			create: {
				width: 1600,
				height: 1200,
				channels: 3,
				background: '#ff5500',
			},
		})
			.jpeg({ quality: 100 })
			.toBuffer();

		const result = await service.process(
			{
				buffer: source,
				size: source.length,
				mimetype: 'image/png',
			} as Express.Multer.File,
			'business-profile',
		);

		const metadata = await sharp(result.buffer).metadata();
		expect(result.contentType).toBe('image/webp');
		expect(result.extension).toBe('webp');
		expect(metadata.format).toBe('webp');
		expect(metadata.width).toBe(1024);
		expect(metadata.height).toBe(768);
	});

	it('rejects a non-image buffer even when its declared MIME is allowed', async () => {
		await expect(
			service.process(
				{
					buffer: Buffer.from('not an image'),
					size: 12,
					mimetype: 'image/jpeg',
				} as Express.Multer.File,
				'business-gallery',
			),
		).rejects.toMatchObject<Partial<BadRequestException>>({
			response: expect.objectContaining({ code: 'INVALID_IMAGE' }),
		});
	});

	it('rejects image dimensions above the policy limit', async () => {
		const source = await sharp({
			create: {
				width: 4097,
				height: 1,
				channels: 3,
				background: '#000000',
			},
		})
			.png()
			.toBuffer();

		await expect(
			service.process(
				{
					buffer: source,
					size: source.length,
					mimetype: 'image/png',
				} as Express.Multer.File,
				'business-gallery',
			),
		).rejects.toMatchObject<Partial<BadRequestException>>({
			response: expect.objectContaining({
				code: 'IMAGE_DIMENSIONS_TOO_LARGE',
			}),
		});
	});
});
