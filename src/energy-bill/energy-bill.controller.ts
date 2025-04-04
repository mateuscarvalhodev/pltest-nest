import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Get,
  Param,
  Query,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EnergyBillService } from './energy-bill.service';
import { Response } from 'express';

@Controller('energy-bills')
export class EnergyBillController {
  constructor(private readonly energyBillService: EnergyBillService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEnergyBill(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Arquivo PDF não fornecido');
    }
    return this.energyBillService.processEnergyBill(file);
  }

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('clientNumber') clientNumber?: string,
    @Query('referenceMonth') referenceMonth?: string,
  ) {
    return this.energyBillService.findAll({
      page: +page,
      limit: +limit,
      clientNumber,
      referenceMonth,
    });
  }

  @Get(':id/download')
  async downloadEnergyBill(@Param('id') id: string, @Res() res: Response) {
    const { filePath, filename } =
      await this.energyBillService.getEnergyBillFile(+id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return res.sendFile(filePath);
  }

  @Get('statistics')
  async getMonthlyStatistics(
    @Query('year') year?: string,
    @Query('clientNumber') clientNumber?: string,
  ) {
    return this.energyBillService.getMonthlyStatistics({
      year: year ? parseInt(year, 10) : undefined,
      clientNumber,
    });
  }
}
