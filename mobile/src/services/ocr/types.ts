export interface OcrItem {
  name: string;
  qty: number | null;
  unitPrice: number | null;
  total: number | null;
}

export interface OcrResult {
  items: OcrItem[];
  rawText?: string;
  provider: string;
}
