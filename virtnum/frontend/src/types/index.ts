export interface User {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN';
  balance: number;
  isVerified: boolean;
  createdAt: string;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  isActive: boolean;
  _count?: { numbers: number };
}

export interface VirtualNumber {
  id: string;
  number: string;
  countryId: string;
  country: Country;
  status: 'AVAILABLE' | 'BUSY' | 'EXPIRED' | 'BLOCKED';
  price: number;
  isTelegram: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  user?: { id: string; email: string; username: string };
  numberId: string;
  number: VirtualNumber;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  smsMessages?: SmsMessage[];
}

export interface SmsMessage {
  id: string;
  numberId: string;
  orderId?: string;
  sender: string;
  text: string;
  code?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE' | 'REFUND';
  amount: number;
  description: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminStats {
  users: { total: number; active: number };
  numbers: { total: number; available: number };
  orders: { total: number; active: number };
  revenue: { total: number; daily: Array<{ date: string; revenue: number }> };
  smsToday: number;
  recentOrders: Order[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages?: number;
  };
}
