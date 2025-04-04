import { Module } from '@nestjs/common';
import { EnergyBillController } from './energy-bill.controller';
import { EnergyBillService } from './energy-bill.service';
import { PdfExtractorService } from './pdf-extractor/pdf-extractor.service';

@Module({
  controllers: [EnergyBillController],
  providers: [EnergyBillService, PdfExtractorService],
})
export class EnergyBillModule {}
