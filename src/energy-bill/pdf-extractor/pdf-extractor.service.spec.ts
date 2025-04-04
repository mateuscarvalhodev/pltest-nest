/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { PdfExtractorService } from './pdf-extractor.service';
import * as fs from 'fs/promises';
import * as pdfParse from 'pdf-parse';
import { DefaultExtractor } from './strategies/default-extractor';
import { PdfProcessingError } from '../../../src/common/errors';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

jest.mock('pdf-parse', () => jest.fn());

jest.mock('./strategies/default-extractor', () => {
  return {
    DefaultExtractor: jest.fn().mockImplementation(() => ({
      extract: jest.fn(),
    })),
  };
});

describe('PdfExtractorService', () => {
  let service: PdfExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfExtractorService],
    }).compile();

    service = module.get<PdfExtractorService>(PdfExtractorService);
    jest.clearAllMocks();
  });

  describe('extractDataFromPdf', () => {
    it('should extract data from PDF successfully', async () => {
      const filePath = '/path/to/test.pdf';
      const pdfBuffer = Buffer.from('pdf content');
      const pdfText = 'extracted text';
      const extractedData = { clientNumber: '123', referenceMonth: 'JAN-2024' };

      (fs.readFile as jest.Mock).mockResolvedValue(pdfBuffer);
      (pdfParse as jest.Mock).mockResolvedValue({ text: pdfText });

      const mockExtract = jest.fn().mockReturnValue(extractedData);
      (DefaultExtractor as jest.Mock).mockImplementation(() => ({
        extract: mockExtract,
      }));

      const result = await service.extractDataFromPdf(filePath);

      expect(result).toEqual(extractedData);
      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(pdfParse).toHaveBeenCalledWith(pdfBuffer);
      expect(mockExtract).toHaveBeenCalledWith(pdfText);
    });

    it('should throw PdfProcessingError if fs.readFile fails', async () => {
      const filePath = '/path/to/test.pdf';
      const errorMessage = 'File not found';

      (fs.readFile as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(service.extractDataFromPdf(filePath)).rejects.toThrow(
        new PdfProcessingError(errorMessage, expect.any(Error)),
      );
      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(pdfParse).not.toHaveBeenCalled();
    });

    it('should throw PdfProcessingError if pdfParse fails', async () => {
      const filePath = '/path/to/test.pdf';
      const pdfBuffer = Buffer.from('pdf content');
      const errorMessage = 'PDF parsing error';

      (fs.readFile as jest.Mock).mockResolvedValue(pdfBuffer);
      (pdfParse as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(service.extractDataFromPdf(filePath)).rejects.toThrow(
        new PdfProcessingError(errorMessage, expect.any(Error)),
      );
      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(pdfParse).toHaveBeenCalledWith(pdfBuffer);
    });

    it('should throw PdfProcessingError with generic message for unknown errors', async () => {
      const filePath = '/path/to/test.pdf';
      const unknownError = 'something unexpected';

      (fs.readFile as jest.Mock).mockRejectedValue(unknownError);

      await expect(service.extractDataFromPdf(filePath)).rejects.toThrow(
        new PdfProcessingError(
          'Erro desconhecido no processamento do PDF',
          undefined,
        ),
      );
      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(pdfParse).not.toHaveBeenCalled();
    });
  });
});
