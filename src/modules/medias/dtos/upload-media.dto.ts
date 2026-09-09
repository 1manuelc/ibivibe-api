import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UploadMediaDto {
	@IsOptional() @IsString() @MaxLength(300) alt_text?: string;
}

export class UpdateBusinessMediaDto {
	@IsOptional()
	@Transform(({ value }) => Number(value))
	@IsInt()
	@Min(0)
	position?: number;
	@IsOptional() @IsString() @MaxLength(300) alt_text?: string;
}

export class ReorderBusinessMediaDto {
	@IsString({ each: true }) media_ids: string[];
}
