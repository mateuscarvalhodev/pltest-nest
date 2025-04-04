import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PdfExtractorService } from './pdf-extractor/pdf-extractor.service';
import {
  FileOperationError,
  PdfProcessingError,
  ValidationError,
  DatabaseError,
  AppError,
  BadRequestError,
} from '../common/errors';

import { ExtractedEnergyBillData } from './pdf-extractor/strategies/base-extractor';
import { Client, EnergyBill } from '@prisma/client';

@Injectable()
export class EnergyBillService {
  private readonly uploadsDir = path.join(__dirname, '../../uploads');
  private readonly tempDir = path.join(this.uploadsDir, 'temp');

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfExtractor: PdfExtractorService,
  ) {
    void this.ensureDirsExist();
  }

  private async ensureDirsExist(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error: unknown) {
      throw new FileOperationError(
        'save',
        this.tempDir,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async saveTempFile(
    buffer: Buffer,
    originalname: string,
  ): Promise<string> {
    const tempFilename = `temp-${Date.now()}-${originalname}`;
    const tempPath = path.join(this.tempDir, tempFilename);

    try {
      await fs.writeFile(tempPath, buffer);
      return tempPath;
    } catch (error: unknown) {
      throw new FileOperationError(
        'save',
        tempPath,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async moveToClientFolder(
    tempPath: string,
    clientNumber: string,
    referenceMonth: string,
    originalname: string,
  ): Promise<string> {
    const baseName = path.basename(originalname, path.extname(originalname));
    const sanitizedReferenceMonth = referenceMonth.replace(
      /[\\/:*?"<>|]/g,
      '-',
    );
    const newFilename = `${baseName}-${sanitizedReferenceMonth}${path.extname(originalname)}`;
    const clientDir = path.join(this.uploadsDir, clientNumber);
    const newPath = path.join(clientDir, newFilename);

    try {
      await fs.access(tempPath);

      await fs.mkdir(clientDir, { recursive: true });

      await fs.rename(tempPath, newPath);
      return newFilename;
    } catch (error: unknown) {
      throw new FileOperationError(
        'move',
        clientDir,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > oneHour) {
          await fs.unlink(filePath).catch((err) => {
            throw new FileOperationError(
              'delete',
              filePath,
              err instanceof Error ? err : new Error(String(err)),
            );
          });
        }
      }
    } catch (error: unknown) {
      throw new FileOperationError(
        'delete',
        this.tempDir,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async processEnergyBill(file: {
    buffer: Buffer;
    originalname: string;
  }): Promise<EnergyBill> {
    let tempPath = '';
    try {
      tempPath = await this.saveTempFile(file.buffer, file.originalname);
      let extractedData: ExtractedEnergyBillData;

      try {
        extractedData = await this.pdfExtractor.extractDataFromPdf(tempPath);
      } catch (error: unknown) {
        await this.cleanupTempFiles();
        throw new PdfProcessingError(
          error instanceof Error
            ? error.message
            : 'Erro desconhecido no processamento do PDF',
          error instanceof Error ? error : undefined,
        );
      }

      if (!extractedData.clientNumber || !extractedData.referenceMonth) {
        await this.cleanupTempFiles();
        throw new ValidationError('Dados essenciais não encontrados no PDF', {
          missingFields: {
            clientNumber: !extractedData.clientNumber,
            referenceMonth: !extractedData.referenceMonth,
          },
        });
      }

      try {
        if (!this.prisma) {
          await this.cleanupTempFiles();
          throw new Error('Prisma client is not initialized');
        }

        const existingBill = await this.prisma.energyBill.findFirst({
          where: {
            OR: [
              ...(extractedData.billNumber
                ? [{ billNumber: extractedData.billNumber }]
                : []),
              {
                AND: [
                  { clientNumber: extractedData.clientNumber },
                  { referenceMonth: extractedData.referenceMonth },
                  { totalAmount: extractedData.totalAmount },
                ],
              },
            ],
          },
        });

        if (existingBill) {
          await this.cleanupTempFiles();
          throw new BadRequestError('Esta fatura já foi inserida no sistema', {
            duplicateInfo: {
              billNumber: extractedData.billNumber,
              clientNumber: extractedData.clientNumber,
              referenceMonth: extractedData.referenceMonth,
            },
          });
        }

        let client = await this.prisma.client.findFirst({
          where: { clientNumber: extractedData.clientNumber },
        });

        if (!client) {
          client = await this.prisma.client.create({
            data: {
              clientNumber: extractedData.clientNumber,
              installationNumber: extractedData.installationNumber,
              name: extractedData.clientName,
              address: extractedData.address,
            },
          });
        }

        const dueDate = extractedData.dueDate
          ? new Date(this.formatDateString(extractedData.dueDate))
          : new Date();

        const storedFilename = await this.moveToClientFolder(
          tempPath,
          extractedData.clientNumber,
          extractedData.referenceMonth,
          file.originalname,
        );

        const relativePath = `${extractedData.clientNumber}/${storedFilename}`;

        const savedBill = await this.prisma.energyBill.create({
          data: {
            clientNumber: extractedData.clientNumber,
            referenceMonth: extractedData.referenceMonth,
            dueDate: dueDate,
            consumptionKwh: extractedData.consumptionKwh,
            totalAmount: extractedData.totalAmount,
            originalFilename: file.originalname,
            storedFilename: relativePath,
            barcode: extractedData.barcode,
            billNumber: extractedData.billNumber,
            previousReading: extractedData.previousReading,
            currentReading: extractedData.currentReading,
            readingDate: new Date(),
            energyTax: extractedData.energyTax,
            processingStatus: 'PROCESSED',
            processingErrors: null,
          },
        });

        await this.cleanupTempFiles();

        return savedBill;
      } catch (error: unknown) {
        await this.cleanupTempFiles();
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new DatabaseError(
          'Falha ao salvar fatura no banco de dados',
          error instanceof Error ? JSON.stringify(error) : undefined,
        );
      }
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao processar fatura',
      );
    }
  }

  private formatDateString(dateStr: string): string {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }

  async findAll(params: {
    page: number;
    limit: number;
    clientNumber?: string;
    referenceMonth?: string;
  }): Promise<{
    data: (EnergyBill & { client: Client })[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { page, limit, clientNumber, referenceMonth } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(clientNumber && { clientNumber }),
      ...(referenceMonth && { referenceMonth }),
    };

    try {
      const [data, total] = await Promise.all([
        this.prisma.energyBill.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            id: 'asc',
          },
          include: {
            client: true,
          },
        }),
        this.prisma.energyBill.count({ where }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: unknown) {
      throw new DatabaseError(
        'Falha ao buscar contas de energia',
        error instanceof Error ? JSON.stringify(error) : undefined,
      );
    }
  }

  async findOne(id: number): Promise<EnergyBill & { client: Client }> {
    try {
      const energyBill = await this.prisma.energyBill.findUnique({
        where: { id },
        include: {
          client: true,
        },
      });

      if (!energyBill) {
        throw new NotFoundException(
          `Conta de energia com ID ${id} não encontrada`,
        );
      }

      return energyBill;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to fetch energy bill with ID ${id}`,
        error instanceof Error ? JSON.stringify(error) : undefined,
      );
    }
  }

  async getEnergyBillFile(
    id: number,
  ): Promise<{ filePath: string; filename: string }> {
    try {
      const energyBill = await this.prisma.energyBill.findUnique({
        where: { id },
      });
      if (!energyBill) {
        throw new NotFoundException(
          `Conta de energia com ID ${id} não encontrada`,
        );
      }

      const filePath = path.join(this.uploadsDir, energyBill.storedFilename);
      await fs.access(filePath);

      return {
        filePath,
        filename: energyBill.originalFilename,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(
        `Arquivo para a fatura com ID ${id} não encontrado no servidor`,
      );
    }
  }

  async getMonthlyStatistics(params: {
    year?: number;
    clientNumber?: string;
  }): Promise<
    Record<
      string,
      {
        consumo: { total: number; compensado: number };
        valor: { 'Valor Sem GD': number; 'Economia GD': number };
      }
    >
  > {
    const { year = 2024, clientNumber } = params;
    try {
      const rawStats = await this.prisma.energyBill.groupBy({
        by: ['referenceMonth'],
        where: {
          ...(clientNumber && { clientNumber }),
          referenceMonth: {
            contains: `${year}`,
          },
        },
        _sum: {
          consumptionKwh: true,
          totalAmount: true,
        },
      });
      const stats: Record<
        string,
        {
          consumo: { total: number; compensado: number };
          valor: { 'Valor Sem GD': number; 'Economia GD': number };
        }
      > = {};

      rawStats.forEach((stat) => {
        const monthYear = stat.referenceMonth.toLowerCase().replace('-', '/');
        const totalConsumption = stat._sum.consumptionKwh || 0;
        const totalValue = stat._sum.totalAmount || 0;

        const compensado = totalConsumption * 0.3;
        const economiaGD = totalValue * 0.5;

        stats[monthYear] = {
          consumo: {
            total: totalConsumption,
            compensado: compensado,
          },
          valor: {
            'Valor Sem GD': totalValue,
            'Economia GD': economiaGD,
          },
        };
      });

      for (let month = 1; month <= 12; month++) {
        const key = `${this.monthToAbbr(month).toLowerCase()}/${String(year)}`;
        if (!stats[key]) {
          stats[key] = {
            consumo: { total: 0, compensado: 0 },
            valor: { 'Valor Sem GD': 0, 'Economia GD': 0 },
          };
        }
      }

      return stats;
    } catch (error: unknown) {
      throw new DatabaseError(
        'Falha ao buscar estatísticas mensais',
        error instanceof Error ? JSON.stringify(error) : undefined,
      );
    }
  }

  private monthToAbbr(month: number): string {
    const months = [
      'JAN',
      'FEV',
      'MAR',
      'ABR',
      'MAI',
      'JUN',
      'JUL',
      'AGO',
      'SET',
      'OUT',
      'NOV',
      'DEZ',
    ];
    return months[month - 1] || '';
  }
}
