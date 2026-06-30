import { VendorCategory } from './auth.js';

export interface VendorProduct {
  id: string;
  vendorId: string;
  productName: string;
  productType: VendorCategory;
  unit: string;
  quantity: number;      // total committed across all active orders
  pricePerUnit: number;  // price from the most recent order acceptance
  createdAt: string;
  updatedAt: string;
}
