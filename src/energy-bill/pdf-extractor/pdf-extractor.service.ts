/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as pdfParse from 'pdf-parse';
import { DefaultExtractor } from './strategies/default-extractor';
import { PdfProcessingError } from '@/common/errors';

@Injectable()
export class PdfExtractorService {
  async extractDataFromPdf(filePath: string) {
    try {
      const pdfBuffer = await fs.readFile(filePath);

      const pdfData = await pdfParse(pdfBuffer);
      const text = pdfData.text;

      const extractor = new DefaultExtractor();
      const extractedData = extractor.extract(text);

      return extractedData;
    } catch (error: unknown) {
      throw new PdfProcessingError(
        error instanceof Error
          ? error.message
          : 'Erro desconhecido no processamento do PDF',
        error instanceof Error ? error : undefined,
      );
    }
  }
}
