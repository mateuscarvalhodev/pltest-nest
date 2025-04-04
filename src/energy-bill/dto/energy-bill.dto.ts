import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class EnergyBillDto {
  @IsNotEmpty()
  @IsString()
  clientNumber: string;

  @IsNotEmpty()
  @IsString()
  referenceMonth: string;

  @IsNotEmpty()
  @IsDateString()
  dueDate: string;

  @IsNotEmpty()
  @IsNumber()
  consumptionKwh: number;

  @IsNotEmpty()
  @IsNumber()
  totalAmount: number;

  @IsNotEmpty()
  @IsString()
  originalFilename: string;

  @IsNotEmpty()
  @IsString()
  storedFilename: string;

  @IsNotEmpty()
  @IsString()
  barcode: string;

  @IsOptional()
  @IsString()
  billNumber?: string;

  @IsOptional()
  @IsString()
  previousReading?: string;

  @IsOptional()
  @IsString()
  currentReading?: string;

  @IsOptional()
  @IsDateString()
  readingDate?: string;

  @IsOptional()
  @IsNumber()
  energyTax?: number;

  @IsOptional()
  @IsNumber()
  distributionTax?: number;

  @IsOptional()
  additionalTaxes?: Record<string, number>;
}
