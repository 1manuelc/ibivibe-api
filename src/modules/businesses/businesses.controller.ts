import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Query,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { CurrentAccount } from 'src/modules/common/decorators/current-account.decorator';
import { Public } from 'src/modules/common/decorators/public.decorator';
import {
	ReorderBusinessMediaDto,
	UpdateBusinessMediaDto,
	UploadMediaDto,
} from 'src/modules/medias/dtos/upload-media.dto';
import { MediasService } from 'src/modules/medias/medias.service';

import { BusinessesService } from './businesses.service';
import {
	UpdateBusinessHoursDto,
	BusinessHourExceptionDto,
} from './dto/business-hours.dto';
import {
	CreateBusinessLocationDto,
	UpdateBusinessLocationDto,
} from './dto/business-location.dto';
import { BusinessOnboardingDto } from './dto/business-onboarding.dto';
import {
	UpdateBusinessProfileDto,
	UpdateBusinessContactDto,
} from './dto/business-profile.dto';
import {
	CreateBusinessServiceDto,
	UpdateBusinessServiceDto,
} from './dto/business-service.dto';
import { UpdateBusinessTagsDto } from './dto/business-tags.dto';

const imageUploadOptions = {
	limits: { fileSize: 5 * 1024 * 1024, files: 1 },
	fileFilter: (
		_req: unknown,
		file: Express.Multer.File,
		callback: (error: Error | null, acceptFile: boolean) => void,
	) =>
		callback(
			null,
			['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype),
		),
};

@ApiTags('businesses')
@ApiBearerAuth()
@Controller({ path: 'businesses', version: '1' })
export class BusinessesController {
	constructor(
		private readonly businessesService: BusinessesService,
		private readonly mediasService: MediasService,
	) {}

	// Mantido como método de compatibilidade para integrações antigas; novas criações usam onboarding,
	// que deriva o proprietário da conta autenticada.
	create(dto: any) {
		return this.businessesService.create(dto);
	}
	getBusinessMedia(id: string) {
		return this.mediasService.getMediaByAccount(id);
	}

	@ApiOperation({ summary: 'Concluir o onboarding de uma empresa' })
	@ApiBody({ type: BusinessOnboardingDto })
	@ApiResponse({ status: 201, description: 'Empresa criada com sucesso' })
	@ApiResponse({ status: 409, description: 'A conta já possui uma empresa' })
	@Post('onboarding')
	onboarding(
		@CurrentAccount('id') accountId: string,
		@Body() dto: BusinessOnboardingDto,
	) {
		return this.businessesService.onboard(accountId, dto);
	}

	@ApiOperation({ summary: 'Obter todas as empresas' })
	@ApiResponse({ status: 200, description: 'Lista pública de empresas' })
	@Get()
	@Public()
	findAll() {
		return this.businessesService.findAll();
	}

	@ApiOperation({ summary: 'Obter o perfil público agregado da empresa' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiResponse({
		status: 200,
		description:
			'Identidade, contato, localização, funcionamento, serviços, avaliações e eventos',
	})
	@ApiResponse({ status: 404, description: 'Empresa não encontrada' })
	@Get(':id/public-profile')
	@Public()
	publicProfile(@Param('id') id: string) {
		return this.businessesService.publicProfile(id);
	}

	@ApiOperation({ summary: 'Buscar uma empresa pelo ID' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiResponse({ status: 200, description: 'Dados públicos da empresa' })
	@ApiResponse({ status: 404, description: 'Empresa não encontrada' })
	@Get(':id')
	@Public()
	findOne(@Param('id') id: string) {
		return this.businessesService.findOne(id);
	}

	@ApiOperation({ summary: 'Atualizar o perfil empresarial' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiBody({ type: UpdateBusinessProfileDto })
	@ApiResponse({ status: 200, description: 'Perfil atualizado' })
	@ApiResponse({
		status: 403,
		description: 'A conta autenticada não é proprietária',
	})
	@Patch(':id/profile')
	updateProfile(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: UpdateBusinessProfileDto,
	) {
		return this.businessesService.updateProfile(id, accountId, dto);
	}

	@ApiOperation({ summary: 'Obter telefone, WhatsApp, e-mail e redes sociais' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiResponse({ status: 200, description: 'Dados de contato estruturados' })
	@Get(':id/contact')
	@Public()
	getContact(@Param('id') id: string) {
		return this.businessesService.getContact(id);
	}

	@ApiOperation({ summary: 'Atualizar contato e redes sociais' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiBody({ type: UpdateBusinessContactDto })
	@ApiResponse({ status: 200, description: 'Contato atualizado' })
	@ApiResponse({
		status: 403,
		description: 'A conta autenticada não é proprietária',
	})
	@Patch(':id/contact')
	updateContact(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: UpdateBusinessContactDto,
	) {
		return this.businessesService.updateContact(id, accountId, dto);
	}

	@ApiOperation({ summary: 'Listar matriz e filiais' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@Get(':id/locations')
	@Public()
	locations(@Param('id') id: string) {
		return this.businessesService.locations(id);
	}

	@ApiOperation({ summary: 'Adicionar matriz ou filial' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiBody({ type: CreateBusinessLocationDto })
	@ApiResponse({
		status: 409,
		description: 'Cidade duplicada ou segunda matriz',
	})
	@Post(':id/locations')
	createLocation(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: CreateBusinessLocationDto,
	) {
		return this.businessesService.createLocation(id, accountId, dto);
	}

	@ApiOperation({ summary: 'Atualizar endereço de uma unidade' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiParam({ name: 'locationId', description: 'UUID da unidade' })
	@ApiBody({ type: UpdateBusinessLocationDto })
	@Patch(':id/locations/:locationId')
	updateLocation(
		@Param('id') id: string,
		@Param('locationId') locationId: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: UpdateBusinessLocationDto,
	) {
		return this.businessesService.updateLocation(
			id,
			locationId,
			accountId,
			dto,
		);
	}

	@ApiOperation({ summary: 'Remover uma unidade' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiParam({ name: 'locationId', description: 'UUID da unidade' })
	@Delete(':id/locations/:locationId')
	deleteLocation(
		@Param('id') id: string,
		@Param('locationId') locationId: string,
		@CurrentAccount('id') accountId: string,
	) {
		return this.businessesService.deleteLocation(id, locationId, accountId);
	}

	@ApiOperation({ summary: 'Listar horários de funcionamento' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@Get(':id/hours')
	@Public()
	hours(@Param('id') id: string) {
		return this.businessesService.getHours(id);
	}

	@ApiOperation({ summary: 'Substituir horários de funcionamento' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiBody({ type: UpdateBusinessHoursDto })
	@Put(':id/hours')
	putHours(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: UpdateBusinessHoursDto,
	) {
		return this.businessesService.putHours(id, accountId, dto.hours);
	}

	@ApiOperation({ summary: 'Consultar status atual de funcionamento' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiQuery({ name: 'cityId', required: false, description: 'UUID da unidade' })
	@Get(':id/hours/status')
	@Public()
	hoursStatus(@Param('id') id: string, @Query('cityId') cityId?: string) {
		return this.businessesService.hoursStatus(id, cityId);
	}

	@ApiOperation({ summary: 'Substituir exceções e feriados' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiBody({ type: BusinessHourExceptionDto, isArray: true })
	@Put(':id/hours/exceptions')
	putExceptions(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: BusinessHourExceptionDto[],
	) {
		return this.businessesService.putExceptions(id, accountId, dto);
	}

	@ApiOperation({ summary: 'Listar serviços ativos' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@Get(':id/services')
	@Public()
	services(@Param('id') id: string) {
		return this.businessesService.services(id);
	}

	@ApiOperation({ summary: 'Criar serviço' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiBody({ type: CreateBusinessServiceDto })
	@Post(':id/services')
	createService(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: CreateBusinessServiceDto,
	) {
		return this.businessesService.createService(id, accountId, dto);
	}

	@ApiOperation({ summary: 'Editar serviço' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiParam({ name: 'serviceId', description: 'UUID do serviço' })
	@ApiBody({ type: UpdateBusinessServiceDto })
	@Patch(':id/services/:serviceId')
	updateService(
		@Param('id') id: string,
		@Param('serviceId') serviceId: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: UpdateBusinessServiceDto,
	) {
		return this.businessesService.updateService(id, serviceId, accountId, dto);
	}

	@ApiOperation({ summary: 'Remover serviço' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiParam({ name: 'serviceId', description: 'UUID do serviço' })
	@Delete(':id/services/:serviceId')
	deleteService(
		@Param('id') id: string,
		@Param('serviceId') serviceId: string,
		@CurrentAccount('id') accountId: string,
	) {
		return this.businessesService.deleteService(id, serviceId, accountId);
	}

	@ApiOperation({ summary: 'Associar ou remover tags da empresa' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiBody({ type: UpdateBusinessTagsDto })
	@Put(':id/tags')
	updateTags(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: UpdateBusinessTagsDto,
	) {
		return this.businessesService.updateTags(id, accountId, dto.tag_ids);
	}

	@ApiOperation({ summary: 'Listar mídias da empresa' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@Get(':id/media')
	@Public()
	media(@Param('id') id: string) {
		return this.mediasService.getMediaByBusiness(id);
	}

	@ApiOperation({ summary: 'Fazer upload e associar mídia à empresa' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: { type: 'string', format: 'binary' },
				alt_text: { type: 'string' },
			},
			required: ['file'],
		},
	})
	@Post(':id/media')
	@UseInterceptors(FileInterceptor('file', imageUploadOptions))
	mediaUpload(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@UploadedFile() file: Express.Multer.File,
		@Body() dto: UploadMediaDto,
	) {
		return this.mediasService.addBusinessMedia(id, accountId, file, dto);
	}

	@ApiOperation({ summary: 'Enviar foto de perfil da empresa' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: { file: { type: 'string', format: 'binary' } },
			required: ['file'],
		},
	})
	@Post(':id/profile-photo')
	@UseInterceptors(FileInterceptor('file', imageUploadOptions))
	profilePhotoUpload(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@UploadedFile() file: Express.Multer.File,
	) {
		return this.mediasService.uploadBusinessProfilePhoto(id, accountId, file);
	}

	@ApiOperation({ summary: 'Remover foto de perfil da empresa' })
	@Delete(':id/profile-photo')
	profilePhotoDelete(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
	) {
		return this.mediasService.removeBusinessProfilePhoto(id, accountId);
	}

	@ApiOperation({ summary: 'Reordenar mídias da empresa' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiBody({ type: ReorderBusinessMediaDto })
	@Patch(':id/media/order')
	mediaOrder(
		@Param('id') id: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: ReorderBusinessMediaDto,
	) {
		return this.mediasService.reorderBusinessMedia(
			id,
			accountId,
			dto.media_ids,
		);
	}

	@ApiOperation({
		summary: 'Atualizar capa, posição ou texto alternativo da mídia',
	})
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiParam({ name: 'mediaId', description: 'UUID da mídia' })
	@ApiBody({ type: UpdateBusinessMediaDto })
	@Patch(':id/media/:mediaId')
	mediaUpdate(
		@Param('id') id: string,
		@Param('mediaId') mediaId: string,
		@CurrentAccount('id') accountId: string,
		@Body() dto: UpdateBusinessMediaDto,
	) {
		return this.mediasService.updateBusinessMedia(id, mediaId, accountId, dto);
	}

	@ApiOperation({ summary: 'Remover mídia da empresa' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiParam({ name: 'mediaId', description: 'UUID da mídia' })
	@Delete(':id/media/:mediaId')
	mediaDelete(
		@Param('id') id: string,
		@Param('mediaId') mediaId: string,
		@CurrentAccount('id') accountId: string,
	) {
		return this.mediasService.removeBusinessMedia(id, mediaId, accountId);
	}

	@ApiOperation({ summary: 'Remover uma empresa' })
	@ApiParam({ name: 'id', description: 'UUID da empresa' })
	@ApiResponse({ status: 200, description: 'Empresa removida com sucesso' })
	@ApiResponse({
		status: 403,
		description: 'A conta autenticada não é proprietária',
	})
	@Delete(':id')
	remove(@Param('id') id: string, @CurrentAccount('id') accountId: string) {
		return this.businessesService.remove(id, accountId);
	}
}
