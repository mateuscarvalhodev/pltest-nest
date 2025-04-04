import { Test, TestingModule } from '@nestjs/testing';
import { EnergyBillService } from './energy-bill.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfExtractorService } from './pdf-extractor/pdf-extractor.service';
import * as fs from 'fs/promises';
import {
  DatabaseError,
  FileOperationError,
  PdfProcessingError,
  ValidationError,
} from '../common/errors';
import { ExtractedEnergyBillData } from './pdf-extractor/strategies/base-extractor';
import { NotFoundException } from '@nestjs/common';

// Mock completo do fs/promises antes de qualquer import que use o serviço
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  rename: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({ mtimeMs: Date.now() }),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('EnergyBillService', () => {
  let service: EnergyBillService;
  let prismaService: PrismaService;
  let pdfExtractorService: PdfExtractorService;

  const mockPrismaService = {
    energyBill: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockPdfExtractorService = {
    extractDataFromPdf: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnergyBillService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PdfExtractorService, useValue: mockPdfExtractorService },
      ],
    }).compile();

    service = module.get<EnergyBillService>(EnergyBillService);
    prismaService = module.get<PrismaService>(PrismaService);
    pdfExtractorService = module.get<PdfExtractorService>(PdfExtractorService);

    jest.clearAllMocks();
  });

  describe('ensureDirsExist', () => {
    it('should create temp directory if it does not exist', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(service['ensureDirsExist']()).resolves.toBeUndefined();
      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });

    it('should throw FileOperationError if mkdir fails', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValueOnce(new Error('mkdir error'));

      await expect(service['ensureDirsExist']()).rejects.toThrow(
        FileOperationError,
      );
    });
  });

  describe('saveTempFile', () => {
    it('should save file and return temp path', async () => {
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);

      const buffer = Buffer.from('test');
      const originalname = 'test.pdf';
      const result = await service['saveTempFile'](buffer, originalname);

      expect(result).toContain('temp-');
      expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), buffer);
    });

    it('should throw FileOperationError if write fails', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValueOnce(
        new Error('write error'),
      );

      await expect(
        service['saveTempFile'](Buffer.from(''), 'test.pdf'),
      ).rejects.toThrow(FileOperationError);
    });
  });

  describe('moveToClientFolder', () => {
    it('should move file to client folder and return new filename', async () => {
      (fs.access as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.rename as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await service['moveToClientFolder'](
        '/temp/test.pdf',
        '123',
        'JAN-2024',
        'original.pdf',
      );

      expect(result).toMatch(/original-JAN-2024\.pdf/);
      expect(fs.rename).toHaveBeenCalled();
    });

    it('should throw FileOperationError if operations fail', async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(new Error('access error'));

      await expect(
        service['moveToClientFolder'](
          '/temp/test.pdf',
          '123',
          'JAN-2024',
          'original.pdf',
        ),
      ).rejects.toThrow(FileOperationError);
    });
  });

  describe('cleanupTempFiles', () => {
    it('should clean up old temp files', async () => {
      (fs.readdir as jest.Mock).mockResolvedValueOnce(['file1.pdf']);
      (fs.stat as jest.Mock).mockResolvedValueOnce({
        mtimeMs: Date.now() - 2 * 60 * 60 * 1000,
      });
      (fs.unlink as jest.Mock).mockResolvedValueOnce(undefined);

      await service['cleanupTempFiles']();
      expect(fs.unlink).toHaveBeenCalledWith(expect.any(String));
    });

    it('should throw error on failure', async () => {
      (fs.readdir as jest.Mock).mockRejectedValueOnce(
        new Error('readdir error'),
      );
      await expect(service['cleanupTempFiles']()).rejects.toThrow(
        FileOperationError,
      );
    });
  });

  describe('processEnergyBill', () => {
    const file = { buffer: Buffer.from('test'), originalname: 'test.pdf' };
    const extractedData: Partial<ExtractedEnergyBillData> = {
      clientNumber: '123',
      referenceMonth: 'JAN-2024',
      dueDate: '10/01/2024',
      consumptionKwh: 100,
      totalAmount: 200,
      billNumber: 'bill123',
    };

    beforeEach(() => {
      jest
        .spyOn(service as any, 'saveTempFile')
        .mockResolvedValue('/temp/test.pdf');
      jest
        .spyOn(service as any, 'moveToClientFolder')
        .mockResolvedValue('test-JAN-2024.pdf');
      jest
        .spyOn(service as any, 'cleanupTempFiles')
        .mockResolvedValue(undefined);
    });

    it('should process energy bill successfully', async () => {
      mockPdfExtractorService.extractDataFromPdf.mockResolvedValue(
        extractedData,
      );
      mockPrismaService.energyBill.findFirst.mockResolvedValue(null);
      mockPrismaService.client.findFirst.mockResolvedValue(null);
      mockPrismaService.client.create.mockResolvedValue({
        id: 1,
        clientNumber: '123',
      });
      mockPrismaService.energyBill.create.mockResolvedValue({
        id: 1,
        ...extractedData,
      });

      const result = await service.processEnergyBill(file);

      expect(result).toHaveProperty('id', 1);
      expect(mockPrismaService.energyBill.create).toHaveBeenCalled();
    });

    it('should throw PdfProcessingError if PDF extraction fails', async () => {
      mockPdfExtractorService.extractDataFromPdf.mockRejectedValue(
        new Error('pdf error'),
      );

      await expect(service.processEnergyBill(file)).rejects.toThrow(
        PdfProcessingError,
      );
    });

    it('should throw ValidationError if essential data is missing', async () => {
      mockPdfExtractorService.extractDataFromPdf.mockResolvedValue({} as any);

      await expect(service.processEnergyBill(file)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should throw BadRequestError if bill already exists', async () => {
      mockPdfExtractorService.extractDataFromPdf.mockResolvedValue(
        extractedData,
      );
      mockPrismaService.energyBill.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.processEnergyBill(file)).rejects.toThrow(
        DatabaseError,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated energy bills', async () => {
      const mockBills = [{ id: 1, client: { id: 1 } }];
      mockPrismaService.energyBill.findMany.mockResolvedValue(mockBills);
      mockPrismaService.energyBill.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockBills);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should throw DatabaseError on failure', async () => {
      mockPrismaService.energyBill.findMany.mockRejectedValue(
        new Error('db error'),
      );

      await expect(service.findAll({ page: 1, limit: 10 })).rejects.toThrow(
        DatabaseError,
      );
    });
  });

  describe('findOne', () => {
    it('should return an energy bill with client', async () => {
      const mockBill = { id: 1, client: { id: 1 } };
      mockPrismaService.energyBill.findUnique.mockResolvedValue(mockBill);

      const result = await service.findOne(1);
      expect(result).toEqual(mockBill);
    });

    it('should throw NotFoundError if bill not found', async () => {
      mockPrismaService.energyBill.findUnique.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEnergyBillFile', () => {
    it('should return file path and filename', async () => {
      mockPrismaService.energyBill.findUnique.mockResolvedValue({
        id: 1,
        storedFilename: '123/test.pdf',
        originalFilename: 'test.pdf',
      });
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getEnergyBillFile(1);
      expect(result).toEqual({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        filePath: expect.any(String),
        filename: 'test.pdf',
      });
    });

    it('should throw NotFoundError if bill or file not found', async () => {
      mockPrismaService.energyBill.findUnique.mockResolvedValue(null);

      await expect(service.getEnergyBillFile(1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMonthlyStatistics', () => {
    it('should return monthly statistics', async () => {
      mockPrismaService.energyBill.groupBy.mockResolvedValue([
        {
          referenceMonth: 'JAN-2024',
          _sum: { consumptionKwh: 100, totalAmount: 200 },
        },
      ]);

      const result = await service.getMonthlyStatistics({ year: 2024 });

      expect(result['jan/2024']).toEqual({
        consumo: { total: 100, compensado: 30 },
        valor: { 'Valor Sem GD': 200, 'Economia GD': 100 },
      });
    });

    it('should throw DatabaseError on failure', async () => {
      mockPrismaService.energyBill.groupBy.mockRejectedValue(
        new Error('db error'),
      );

      await expect(
        service.getMonthlyStatistics({ year: 2024 }),
      ).rejects.toThrow(DatabaseError);
    });
  });
});
