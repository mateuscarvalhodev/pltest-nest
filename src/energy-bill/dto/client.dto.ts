import { IsNotEmpty, IsString } from 'class-validator';

export class ClientDto {
  @IsNotEmpty()
  @IsString()
  clientNumber: string;

  @IsNotEmpty()
  @IsString()
  installationNumber: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  address: string;
}
