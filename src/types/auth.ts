import { Request } from 'express';

export type UserRole = 'admin' | 'customer' | 'vendor';

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
