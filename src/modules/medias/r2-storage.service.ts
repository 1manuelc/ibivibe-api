import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import {
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class R2StorageService {
	private readonly logger = new Logger(R2StorageService.name);
	private readonly s3: S3Client;
	private readonly bucket: string;
	private readonly publicUrl: string;

	constructor(config: ConfigService) {
		this.s3 = new S3Client({
			region: 'auto',
			endpoint: config.getOrThrow('R2_ENDPOINT'),
			credentials: {
				accessKeyId: config.getOrThrow('R2_ACCESS_KEY'),
				secretAccessKey: config.getOrThrow('R2_SECRET_KEY'),
			},
		});
		this.bucket = config.getOrThrow('R2_BUCKET');
		this.publicUrl = config.getOrThrow('R2_PUBLIC_URL').replace(/\/$/, '');
	}

	async upload(key: string, body: Buffer, contentType: string) {
		try {
			await this.s3.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: key,
					Body: body,
					ContentType: contentType,
					CacheControl: 'public, max-age=31536000, immutable',
				}),
			);
		} catch (error) {
			this.logger.error(`R2 upload failed for key ${key}`, error);
			throw new InternalServerErrorException({
				code: 'UPLOAD_FAILED',
				message: 'The image could not be uploaded.',
			});
		}
		return { key, url: this.getPublicUrl(key) };
	}

	async delete(key: string) {
		try {
			await this.s3.send(
				new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
			);
		} catch (error) {
			this.logger.warn(`R2 deletion failed for key ${key}`, error);
			throw new InternalServerErrorException({
				code: 'DELETE_FAILED',
				message: 'The image could not be deleted.',
			});
		}
		return { deleted: true };
	}

	getPublicUrl(key: string) {
		return `${this.publicUrl}/${key}`;
	}

	keyFromPublicUrl(url: string) {
		return url.startsWith(this.publicUrl + '/')
			? url.slice(this.publicUrl.length + 1)
			: null;
	}
}
