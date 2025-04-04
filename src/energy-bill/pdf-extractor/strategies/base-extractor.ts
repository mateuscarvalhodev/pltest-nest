export interface ExtractedEnergyBillData {
  clientNumber: string;
  clientName: string;
  address: string;
  installationNumber: string;

  referenceMonth: string;
  dueDate: string;
  consumptionKwh: number;
  totalAmount: number;
  barcode: string;

  billNumber?: string;
  previousReading?: string;
  currentReading?: string;
  energyTax?: number;
}

export abstract class BaseExtractor {
  abstract extract(text: string): ExtractedEnergyBillData;
}
