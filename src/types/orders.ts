import { VendorCategory } from './auth.js';

export type { VendorCategory };

export interface Order {
  id: string;
  customerId: string;
  /** Must be one of the 5 vendor categories */
  productType: VendorCategory;
  productName: string; // e.g., "Tomatoes", "Buffalo Meat", etc.
  totalQuantity: number;
  unit: string;
  status: "pending" | "partial" | "completed" | "cancelled";
  fulfilledQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  vendorId: string;
  quantity: number; // quantity vendor is providing
  pricePerUnit: number;
  totalPrice: number;
  status: "pending" | "accepted" | "rejected" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  orderItemId: string;
  orderId: string;
  customerId: string;
  vendorId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
}

export interface CreateOrderInput {
  productType: VendorCategory;
  productName: string;
  totalQuantity: number;
  unit: string;
}

export interface CreateOrderItemInput {
  orderId: string;
  vendorId: string;
  quantity: number;
  pricePerUnit: number;
}

export interface UpdateOrderItemStatusInput {
  status: "accepted" | "rejected" | "completed";
}

export interface Notification {
  id: string;
  vendorId: string;
  orderId: string;
  customerId: string;
  productName: string;
  productType: VendorCategory;
  totalQuantity: number;
  unit: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
