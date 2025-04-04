import { IsNotEmpty } from 'class-validator';

export class UploadEnergyBillDto {
  @IsNotEmpty()
  file: Express.Multer.File;
}
