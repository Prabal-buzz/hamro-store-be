import { Request } from 'express';

export type UserRole = 'admin' | 'customer' | 'vendor';

export type VendorCategory =
  | 'Vegetables and Fruits'
  | 'Non Veg'
  | 'Grocery'
  | 'Spices'
  | 'Beverages';

export const VENDOR_CATEGORIES: VendorCategory[] = [
  'Vegetables and Fruits',
  'Non Veg',
  'Grocery',
  'Spices',
  'Beverages',
];

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
