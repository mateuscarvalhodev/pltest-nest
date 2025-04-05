import { BaseExtractor, ExtractedEnergyBillData } from './base-extractor';

export class DefaultExtractor implements BaseExtractor {
  extract(text: string): ExtractedEnergyBillData {
    const sanitizedText = text.replace(/\n/g, ' ');

    const extract = (regex: RegExp, group = 1): string => {
      const match = sanitizedText.match(regex);
      return match?.[group]?.trim() ?? '';
    };

    const extractFloat = (regex: RegExp, group = 1): number => {
      const raw = extract(regex, group).replace(',', '.');
      const parsed = parseFloat(raw);
      return isNaN(parsed) ? 0 : parsed;
    };

    const extractInt = (regex: RegExp, group = 1): number => {
      const raw = extract(regex, group);
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    const clientNumber = extract(
      /Nº DO CLIENTE\s+Nº DA INSTALAÇÃO\s+(\d+)\s+\d+/,
    );
    const installationNumber = extract(
      /Nº DO CLIENTE\s+Nº DA INSTALAÇÃO\s+\d+\s+(\d+)/,
    );
    const clientName = extract(
      /(\d{8,11}-\d)\s+(?:ATENÇÃO: DÉBITO AUTOMÁTICO\s+)?([\w\sÀ-ÿ]+?)(?=\s+\d|\s+(?:AV|RUA|PRAÇA|TRAVESSA|RODOVIA)|\s*$)/i,
      2,
    );
    const address = extract(
      /(RUA|AV|AVENIDA|ALAMEDA|TRAVESSA) [\w\s.]+ \d+[\s\w,-]* [\w\s]+ \d{5}-\d{3} [\w\s]+, [A-Z]{2}/i,
      0,
    );
    const referenceMonth = extract(/Referente a\s+.*?(\w+\/\d{4})/);
    const dueDate = extract(/Vencimento\s+.*?(\d{2}\/\d{2}\/\d{4})/);
    const consumptionKwh = extractInt(
      /Histórico de Consumo.*?[A-Z]{3}\/\d{2}\s+(\d+)\s+/,
    );
    const totalAmount = extractFloat(/Valor a pagar \(R\$\)\s+.*?(\d+,\d{2})/);
    const barcode = extract(/(\d{11}-\d\s+\d{11}-\d\s+\d{11}-\d\s+\d{11}-\d)/);
    const billNumber = extract(/NOTA FISCAL Nº (\d+)/);

    const readingsMatch = sanitizedText.match(
      /Nº de diasPróxima.*?(\d{2}\/\d{2})(\d{2}\/\d{2})/,
    );
    const previousReading = readingsMatch?.[1] ?? undefined;
    const currentReading = readingsMatch?.[2] ?? undefined;

    const energyTax = extractFloat(/ICMS\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)/);

    const data: ExtractedEnergyBillData = {
      clientNumber,
      clientName,
      address,
      installationNumber,

      referenceMonth,
      dueDate,
      consumptionKwh,
      totalAmount,
      barcode,

      billNumber,
      previousReading,
      currentReading,
      energyTax,
    };
    return data;
  }
}
