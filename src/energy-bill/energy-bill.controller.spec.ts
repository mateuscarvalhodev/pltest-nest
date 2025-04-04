/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EnergyBillController } from './energy-bill.controller';
import { EnergyBillService } from './energy-bill.service';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';

describe('EnergyBillController', () => {
  let controller: EnergyBillController;
  let energyBillService: EnergyBillService;

  const mockEnergyBillService = {
    processEnergyBill: jest.fn(),
    findAll: jest.fn(),
    getEnergyBillFile: jest.fn(),
    getMonthlyStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnergyBillController],
      providers: [
        { provide: EnergyBillService, useValue: mockEnergyBillService },
      ],
    }).compile();

    controller = module.get<EnergyBillController>(EnergyBillController);
    energyBillService = module.get<EnergyBillService>(EnergyBillService);
    jest.clearAllMocks();
  });

  describe('uploadEnergyBill', () => {
    it('should upload an energy bill successfully', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.pdf',
      } as Express.Multer.File;
      const mockResult = { id: 1, clientNumber: '123' };
      mockEnergyBillService.processEnergyBill.mockResolvedValue(mockResult);

      const result = await controller.uploadEnergyBill(file);

      expect(result).toEqual(mockResult);
      expect(mockEnergyBillService.processEnergyBill).toHaveBeenCalledWith(
        file,
      );
    });

    it('should throw BadRequestException if no file is provided', async () => {
      await expect(
        controller.uploadEnergyBill(
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(new BadRequestException('Arquivo PDF não fornecido'));
      expect(mockEnergyBillService.processEnergyBill).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated energy bills with default params', async () => {
      const mockResult = {
        data: [{ id: 1 }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockEnergyBillService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll();

      expect(result).toEqual(mockResult);
      expect(mockEnergyBillService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        clientNumber: undefined,
        referenceMonth: undefined,
      });
    });

    it('should return paginated energy bills with custom params', async () => {
      const mockResult = {
        data: [{ id: 1 }],
        meta: { total: 1, page: 2, limit: 5, totalPages: 1 },
      };
      mockEnergyBillService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(2, 5, '123', 'JAN-2024');

      expect(result).toEqual(mockResult);
      expect(mockEnergyBillService.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        clientNumber: '123',
        referenceMonth: 'JAN-2024',
      });
    });
  });

  describe('downloadEnergyBill', () => {
    it('should download an energy bill file', async () => {
      const mockFile = { filePath: '/path/to/file.pdf', filename: 'test.pdf' };
      mockEnergyBillService.getEnergyBillFile.mockResolvedValue(mockFile);

      const res = {
        set: jest.fn(),
        sendFile: jest.fn(),
      } as unknown as Response;

      await controller.downloadEnergyBill('1', res);

      expect(mockEnergyBillService.getEnergyBillFile).toHaveBeenCalledWith(1);
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="test.pdf"',
      });
      expect(res.sendFile).toHaveBeenCalledWith(mockFile.filePath);
    });

    it('should propagate errors from service', async () => {
      mockEnergyBillService.getEnergyBillFile.mockRejectedValue(
        new Error('File not found'),
      );

      const res = {
        set: jest.fn(),
        sendFile: jest.fn(),
      } as unknown as Response;

      await expect(controller.downloadEnergyBill('1', res)).rejects.toThrow(
        'File not found',
      );
    });
  });

  describe('getMonthlyStatistics', () => {
    it('should return monthly statistics with default params', async () => {
      const mockStats = {
        'jan/2024': {
          consumo: { total: 100, compensado: 30 },
          valor: { 'Valor Sem GD': 200, 'Economia GD': 100 },
        },
      };
      mockEnergyBillService.getMonthlyStatistics.mockResolvedValue(mockStats);

      const result = await controller.getMonthlyStatistics();

      expect(result).toEqual(mockStats);
      expect(mockEnergyBillService.getMonthlyStatistics).toHaveBeenCalledWith({
        year: undefined,
        clientNumber: undefined,
      });
    });

    it('should return monthly statistics with custom params', async () => {
      const mockStats = {
        'jan/2024': {
          consumo: { total: 100, compensado: 30 },
          valor: { 'Valor Sem GD': 200, 'Economia GD': 100 },
        },
      };
      mockEnergyBillService.getMonthlyStatistics.mockResolvedValue(mockStats);

      const result = await controller.getMonthlyStatistics('2024', '123');

      expect(result).toEqual(mockStats);
      expect(mockEnergyBillService.getMonthlyStatistics).toHaveBeenCalledWith({
        year: 2024,
        clientNumber: '123',
      });
    });
  });
});
