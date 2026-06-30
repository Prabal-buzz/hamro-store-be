import { VendorCategory } from './auth.js';

export interface MarketPrice {
  id: string;
  name: string;
  nameNp?: string; // Nepali name from /np API
  unit: string;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  category: VendorCategory;
  imageUrl: string;
  source: 'kalimati' | 'seed';
  date: string; // YYYY-MM-DD
}

export interface MarketPricesResponse {
  date: string;
  category: VendorCategory | 'all';
  prices: MarketPrice[];
}

/** Raw shape returned by kalimatimarket.gov.np */
export interface KalimatiRawItem {
  commodityname: string;
  commodityunit: string;
  minprice: string;
  maxprice: string;
  avgprice: string;
}

export interface KalimatiApiResponse {
  status: number;
  date: string;
  prices: KalimatiRawItem[];
}
