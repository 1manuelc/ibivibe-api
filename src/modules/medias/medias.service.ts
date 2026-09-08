import { randomUUID } from 'crypto';

import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import {
	ConflictException,
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/modules/common/prisma/prisma.service';

@Injectable()
export class MediasService {
	private static readonly MAX_BUSINESS_GALLERY_ITEMS = 10;
	private static readonly ALLOWED_IMAGE_TYPES = new Set([
		'image/jpeg',
		'image/png',
		'image/webp',
	]);
	private readonly s3: S3Client;
	private readonly bucket: string;
	private readonly publicUrl: string;

	constructor(
		private readonly prismaService: PrismaService,
		private readonly config: ConfigService,
	) {
		this.s3 = new S3Client({
			region: 'auto',
			endpoint: config.getOrThrow('R2_ENDPOINT'),
			credentials: {
				accessKeyId: config.getOrThrow('R2_ACCESS_KEY'),
				secretAccessKey: config.getOrThrow('R2_SECRET_KEY'),
			},
		});
		this.bucket = config.getOrThrow('R2_BUCKET');
		this.publicUrl = config.getOrThrow('R2_PUBLIC_URL');
	}

	private assertImage(file: Express.Multer.File) {
		if (!file) throw new BadRequestException('Image file is required');
		if (!MediasService.ALLOWED_IMAGE_TYPES.has(file.mimetype))
			throw new BadRequestException(
				'Only JPEG, PNG, and WebP images are allowed',
			);
	}

	private extensionFor(mimetype: string) {
		return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
			mimetype
		]!;
	}

	async upload(
		file: Express.Multer.File,
		folder: 'business-profile' | 'business-gallery',
	) {
		this.assertImage(file);
		const key = `${folder}/${randomUUID()}.${this.extensionFor(file.mimetype)}`;

		await this.s3.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: file.buffer,
				ContentType: file.mimetype,
			}),
		);

		return {
			key,
			url: `${this.publicUrl}/${key}`,
		};
	}

	async delete(key: string) {
		await this.s3.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: key,
			}),
		);

		return { deleted: true };
	}

	getPublicUrl(key: string) {
		return `${this.publicUrl}/${key}`;
	}

	async getMediaByCity(id: string): Promise<any[]> {
		return this.prismaService.media.findMany({
			where: { city_id: id },
			orderBy: [{ is_cover: 'desc' }, { position: 'asc' }],
		});
	}

	async getMediaByAccount(id: string) {
		return this.prismaService.media.findMany({
			where: { account_id: id },
			orderBy: [{ is_cover: 'desc' }, { position: 'asc' }],
		});
	}

	async getMediaByBusiness(id: string) {
		return this.prismaService.media.findMany({
			where: { business_id: id },
			orderBy: [{ is_cover: 'desc' }, { position: 'asc' }],
		});
	}

	private async assertOwner(businessId: string, accountId: string) {
		const business = await this.prismaService.business.findUnique({
			where: { id: businessId },
			select: { owner_account_id: true },
		});
		if (!business) throw new NotFoundException('Business not found');
		if (business.owner_account_id !== accountId)
			throw new ForbiddenException('You do not own this business');
	}

	private keyFromUrl(url: string) {
		return url.startsWith(this.publicUrl + '/')
			? url.slice(this.publicUrl.length + 1)
			: url;
	}

	async addBusinessMedia(
		businessId: string,
		accountId: string,
		file: Express.Multer.File,
		dto: any,
	) {
		await this.assertOwner(businessId, accountId);
		this.assertImage(file);
		const count = await this.prismaService.media.count({
			where: { business_id: businessId },
		});
		if (count >= MediasService.MAX_BUSINESS_GALLERY_ITEMS)
			throw new ConflictException(
				'Business gallery limit of 10 images reached',
			);
		const uploaded = await this.upload(file, 'business-gallery');
		try {
			return await this.prismaService.$transaction(async (tx) => {
				const position =
					dto.position ??
					(await tx.media.count({ where: { business_id: businessId } }));
				return tx.media.create({
					data: {
						business_id: businessId,
						media_type: 'image',
						url: uploaded.url,
						is_cover: false,
						position,
						alt_text: dto.alt_text,
					},
				});
			});
		} catch (error) {
			await this.delete(uploaded.key).catch(() => undefined);
			throw error;
		}
	}

	async uploadBusinessProfilePhoto(
		businessId: string,
		accountId: string,
		file: Express.Multer.File,
	) {
		await this.assertOwner(businessId, accountId);
		const current = await this.prismaService.business.findUnique({
			where: { id: businessId },
			select: { profile_photo_url: true },
		});
		const uploaded = await this.upload(file, 'business-profile');
		try {
			const business = await this.prismaService.business.update({
				where: { id: businessId },
				data: { profile_photo_url: uploaded.url },
				select: { profile_photo_url: true },
			});
			if (current?.profile_photo_url)
				await this.delete(this.keyFromUrl(current.profile_photo_url)).catch(
					() => undefined,
				);
			return { profile_photo_url: business.profile_photo_url };
		} catch (error) {
			await this.delete(uploaded.key).catch(() => undefined);
			throw error;
		}
	}

	async removeBusinessProfilePhoto(businessId: string, accountId: string) {
		await this.assertOwner(businessId, accountId);
		const business = await this.prismaService.business.findUnique({
			where: { id: businessId },
			select: { profile_photo_url: true },
		});
		if (!business?.profile_photo_url)
			throw new NotFoundException('Profile photo not found');
		await this.prismaService.business.update({
			where: { id: businessId },
			data: { profile_photo_url: null },
		});
		await this.delete(this.keyFromUrl(business.profile_photo_url)).catch(
			() => undefined,
		);
		return { deleted: true };
	}

	async updateBusinessMedia(
		businessId: string,
		mediaId: string,
		accountId: string,
		dto: any,
	) {
		await this.assertOwner(businessId, accountId);
		const media = await this.prismaService.media.findFirst({
			where: { id: mediaId, business_id: businessId },
		});
		if (!media) throw new NotFoundException('Media not found');
		return this.prismaService.$transaction(async (tx) => {
			return tx.media.update({
				where: { id: mediaId },
				data: {
					position: dto.position,
					alt_text: dto.alt_text,
				},
			});
		});
	}

	async removeBusinessMedia(
		businessId: string,
		mediaId: string,
		accountId: string,
	) {
		await this.assertOwner(businessId, accountId);
		const media = await this.prismaService.media.findFirst({
			where: { id: mediaId, business_id: businessId },
		});
		if (!media) throw new NotFoundException('Media not found');
		await this.prismaService.media.delete({ where: { id: mediaId } });
		await this.delete(this.keyFromUrl(media.url)).catch(() => undefined);
		return { deleted: true };
	}

	async reorderBusinessMedia(
		businessId: string,
		accountId: string,
		mediaIds: string[],
	) {
		await this.assertOwner(businessId, accountId);
		const records = await this.prismaService.media.findMany({
			where: { business_id: businessId, id: { in: mediaIds } },
			select: { id: true },
		});
		if (records.length !== mediaIds.length)
			throw new NotFoundException(
				'One or more media do not belong to this business',
			);
		return this.prismaService.$transaction(
			mediaIds.map((id, position) =>
				this.prismaService.media.update({ where: { id }, data: { position } }),
			),
		);
	}
}
