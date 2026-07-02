import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../../price-overrides.json');

export interface PriceOverride {
  productName: string;
  pricePerUnit: number;
  updatedAt: string;
}

function read(): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function write(data: Record<string, number>) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function getAllOverrides(): PriceOverride[] {
  const data = read();
  return Object.entries(data)
    .map(([productName, pricePerUnit]) => ({ productName, pricePerUnit, updatedAt: '' }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

export function getOverrideMap(): Map<string, number> {
  const data = read();
  return new Map(Object.entries(data).map(([k, v]) => [k.toLowerCase(), v]));
}

export function setOverride(productName: string, pricePerUnit: number): PriceOverride {
  const data = read();
  data[productName] = pricePerUnit;
  write(data);
  return { productName, pricePerUnit, updatedAt: new Date().toISOString() };
}

export function deleteOverride(productName: string): void {
  const data = read();
  delete data[productName];
  write(data);
}
