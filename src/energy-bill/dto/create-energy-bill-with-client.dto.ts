import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { ClientDto } from './client.dto';
import { EnergyBillDto } from './energy-bill.dto';

export class CreateEnergyBillWithClientDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ClientDto)
  client: ClientDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => EnergyBillDto)
  energyBill: EnergyBillDto;
}
