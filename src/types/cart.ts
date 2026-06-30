import { VendorCategory } from './orders.js';

export interface CartItem {
  id: string;
  customerId: string;
  productName: string;
  productType: VendorCategory;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddToCartInput {
  productName: string;
  productType: VendorCategory;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  imageUrl?: string;
}

export interface UpdateCartItemInput {
  quantity: number;
}
