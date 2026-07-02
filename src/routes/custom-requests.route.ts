import { Router, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

const router = Router();

// POST /custom-requests — customer submits an off-menu request
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const schema = z.object({
      productName: z.string().min(1, 'Product name is required'),
      category: z.string().min(1, 'Category is required'),
      quantity: z.number().positive('Quantity must be positive'),
      unit: z.string().min(1, 'Unit is required'),
      note: z.string().optional(),
    });
    const { productName, category, quantity, unit, note } = schema.parse(req.body);
    const id = randomUUID();
    const customerId = req.user!.id;

    await prisma.$executeRaw`
      INSERT INTO custom_order_requests
        (id, "customerId", "productName", category, quantity, unit, note, status, "createdAt", "updatedAt")
      VALUES
        (${id}, ${customerId}, ${productName}, ${category}, ${quantity}, ${unit}, ${note ?? null}, 'pending', NOW(), NOW())
    `;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT * FROM custom_order_requests WHERE id = ${id}
    `;
    res.status(201).json({ success: true, data: { request: rows[0] } });
  } catch (error) { next(error); }
});

// GET /custom-requests/my — customer views their own requests
router.get('/my', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const customerId = req.user!.id;
    const requests = await prisma.$queryRaw<any[]>`
      SELECT * FROM custom_order_requests
      WHERE "customerId" = ${customerId}
      ORDER BY "createdAt" DESC
    `;
    res.json({ success: true, data: { requests } });
  } catch (error) { next(error); }
});

// GET /custom-requests — admin views all requests (with optional ?status= filter)
router.get('/', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const status = req.query.status as string | undefined;

    // Join with users table to get customer name + email
    let requests: any[];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      requests = await prisma.$queryRaw<any[]>`
        SELECT r.*, u.name AS "customerName", u.email AS "customerEmail"
        FROM custom_order_requests r
        JOIN users u ON u.id = r."customerId"
        WHERE r.status = ${status}
        ORDER BY r."createdAt" DESC
      `;
    } else {
      requests = await prisma.$queryRaw<any[]>`
        SELECT r.*, u.name AS "customerName", u.email AS "customerEmail"
        FROM custom_order_requests r
        JOIN users u ON u.id = r."customerId"
        ORDER BY r."createdAt" DESC
      `;
    }

    res.json({ success: true, data: { requests } });
  } catch (error) { next(error); }
});

// PUT /custom-requests/:id/status — admin approves or rejects
router.put('/:id/status', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const schema = z.object({
      status: z.enum(['approved', 'rejected']),
      adminNote: z.string().optional(),
    });
    const { status, adminNote } = schema.parse(req.body);
    const { id } = req.params;

    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM custom_order_requests WHERE id = ${id}
    `;
    if (existing.length === 0) return next(new AppError('Request not found', 404));

    await prisma.$executeRaw`
      UPDATE custom_order_requests
      SET status = ${status}, "adminNote" = ${adminNote ?? null}, "updatedAt" = NOW()
      WHERE id = ${id}
    `;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT r.*, u.name AS "customerName", u.email AS "customerEmail"
      FROM custom_order_requests r
      JOIN users u ON u.id = r."customerId"
      WHERE r.id = ${id}
    `;
    res.json({ success: true, data: { request: rows[0] } });
  } catch (error) { next(error); }
});

export default router;
