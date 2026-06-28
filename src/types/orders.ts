export interface Order {
  id: string;
  customerId: string;
  meatType: string;
  totalQuantity: number; // in kg
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
  meatType: string;
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
