import { Router, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

const router = Router();

// ─── GET /services — all services (any authenticated user) ───────────────────
router.get('/', authMiddleware, async (_req, res: Response, next) => {
  try {
    const services = await prisma.$queryRaw<any[]>`
      SELECT * FROM services ORDER BY "createdAt" ASC
    `;
    res.json({ success: true, data: { services } });
  } catch (error) { next(error); }
});

// ─── GET /services/my — customer's own active services ───────────────────────
router.get('/my', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const customerId = req.user!.id;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT cs.id, cs."customerId", cs."serviceId", cs."isActive", cs."activatedAt", cs."activatedBy",
             s.name, s.description, s.price, s."priceType", s.icon
      FROM customer_services cs
      JOIN services s ON s.id = cs."serviceId"
      WHERE cs."customerId" = ${customerId} AND cs."isActive" = TRUE
      ORDER BY cs."activatedAt" DESC
    `;
    res.json({ success: true, data: { services: rows } });
  } catch (error) { next(error); }
});

// ─── GET /services/my-requests — customer's own service requests ──────────────
router.get('/my-requests', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const customerId = req.user!.id;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT sr.*, s.name AS "serviceName", s.icon, s.price, s."priceType", s.description
      FROM service_requests sr
      JOIN services s ON s.id = sr."serviceId"
      WHERE sr."customerId" = ${customerId}
      ORDER BY sr."createdAt" DESC
    `;
    res.json({ success: true, data: { requests: rows } });
  } catch (error) { next(error); }
});

// ─── GET /services/admin/overview — all services + per-customer status ───────
router.get('/admin/overview', authMiddleware, adminMiddleware, async (_req, res: Response, next) => {
  try {
    const services = await prisma.$queryRaw<any[]>`
      SELECT * FROM services ORDER BY "createdAt" ASC
    `;
    const activations = await prisma.$queryRaw<any[]>`
      SELECT cs.*, u.name AS "customerName", u.email AS "customerEmail"
      FROM customer_services cs
      JOIN users u ON u.id = cs."customerId"
      WHERE cs."isActive" = TRUE
    `;
    res.json({ success: true, data: { services, activations } });
  } catch (error) { next(error); }
});

// ─── GET /services/admin/requests — admin sees all service requests ───────────
router.get('/admin/requests', authMiddleware, adminMiddleware, async (_req, res: Response, next) => {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT sr.*, s.name AS "serviceName", s.icon, s.price, s."priceType",
             u.name AS "customerName", u.email AS "customerEmail"
      FROM service_requests sr
      JOIN services s ON s.id = sr."serviceId"
      JOIN users u ON u.id = sr."customerId"
      ORDER BY sr."createdAt" DESC
    `;
    res.json({ success: true, data: { requests: rows } });
  } catch (error) { next(error); }
});

// ─── PUT /services/requests/:requestId — admin approves or rejects ────────────
// NOTE: must come before PUT /:id to avoid Express treating "requests" as a service id
router.put('/requests/:requestId', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { requestId } = req.params;
    const { status, adminNote } = z.object({
      status: z.enum(['approved', 'rejected']),
      adminNote: z.string().optional(),
    }).parse(req.body);

    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM service_requests WHERE id = ${requestId}`;
    if (!rows.length) return next(new AppError('Request not found', 404));
    const sr = rows[0];

    await prisma.$executeRaw`
      UPDATE service_requests
      SET status = ${status}, "adminNote" = ${adminNote ?? null}, "updatedAt" = NOW()
      WHERE id = ${requestId}
    `;

    // If approved, activate the service for the customer
    if (status === 'approved') {
      const adminId = req.user!.id;
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM customer_services
        WHERE "customerId" = ${sr.customerId} AND "serviceId" = ${sr.serviceId}
      `;
      if (existing.length > 0) {
        await prisma.$executeRaw`
          UPDATE customer_services SET "isActive" = TRUE, "activatedAt" = NOW(), "activatedBy" = ${adminId}
          WHERE "customerId" = ${sr.customerId} AND "serviceId" = ${sr.serviceId}
        `;
      } else {
        const id = randomUUID();
        await prisma.$executeRaw`
          INSERT INTO customer_services (id, "customerId", "serviceId", "isActive", "activatedAt", "activatedBy")
          VALUES (${id}, ${sr.customerId}, ${sr.serviceId}, TRUE, NOW(), ${adminId})
        `;
      }
    }

    res.json({ success: true });
  } catch (error) { next(error); }
});

// ─── DELETE /services/requests/:requestId — customer cancels their request ───
// NOTE: must come before DELETE /:id
router.delete('/requests/:requestId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const customerId = req.user!.id;
    const { requestId } = req.params;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id FROM service_requests
      WHERE id = ${requestId} AND "customerId" = ${customerId} AND status = 'pending'
    `;
    if (!rows.length) return next(new AppError('Request not found or not cancellable', 404));
    await prisma.$executeRaw`DELETE FROM service_requests WHERE id = ${requestId}`;
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ─── POST /services — admin creates a service ────────────────────────────────
router.post('/', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().min(0),
      priceType: z.enum(['monthly', 'one-time', 'annual']).default('monthly'),
      icon: z.string().default('home_repair_service'),
    });
    const { name, description, price, priceType, icon } = schema.parse(req.body);
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO services (id, name, description, price, "priceType", icon, "createdAt")
      VALUES (${id}, ${name}, ${description ?? null}, ${price}, ${priceType}, ${icon}, NOW())
    `;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM services WHERE id = ${id}`;
    res.status(201).json({ success: true, data: { service: rows[0] } });
  } catch (error) { next(error); }
});

// ─── PUT /services/:id — admin updates a service ─────────────────────────────
router.put('/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.number().min(0).optional(),
      priceType: z.enum(['monthly', 'one-time', 'annual']).optional(),
      icon: z.string().optional(),
    });
    const { name, description, price, priceType, icon } = schema.parse(req.body);
    const { id } = req.params;
    const existing = await prisma.$queryRaw<any[]>`SELECT id FROM services WHERE id = ${id}`;
    if (!existing.length) return next(new AppError('Service not found', 404));
    await prisma.$executeRaw`
      UPDATE services SET
        name        = COALESCE(${name ?? null}, name),
        description = COALESCE(${description ?? null}, description),
        price       = COALESCE(${price ?? null}::double precision, price),
        "priceType" = COALESCE(${priceType ?? null}, "priceType"),
        icon        = COALESCE(${icon ?? null}, icon)
      WHERE id = ${id}
    `;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM services WHERE id = ${id}`;
    res.json({ success: true, data: { service: rows[0] } });
  } catch (error) { next(error); }
});

// ─── DELETE /services/:id — admin deletes a service ──────────────────────────
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await prisma.$executeRaw`DELETE FROM service_requests WHERE "serviceId" = ${id}`;
    await prisma.$executeRaw`DELETE FROM customer_services WHERE "serviceId" = ${id}`;
    await prisma.$executeRaw`DELETE FROM services WHERE id = ${id}`;
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ─── POST /services/:id/customers/:customerId — admin activates for customer ─
router.post('/:id/customers/:customerId', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: serviceId, customerId } = req.params;
    const adminId = req.user!.id;
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM customer_services WHERE "customerId" = ${customerId} AND "serviceId" = ${serviceId}
    `;
    if (existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE customer_services SET "isActive" = TRUE, "activatedAt" = NOW(), "activatedBy" = ${adminId}
        WHERE "customerId" = ${customerId} AND "serviceId" = ${serviceId}
      `;
    } else {
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO customer_services (id, "customerId", "serviceId", "isActive", "activatedAt", "activatedBy")
        VALUES (${id}, ${customerId}, ${serviceId}, TRUE, NOW(), ${adminId})
      `;
    }
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ─── DELETE /services/:id/customers/:customerId — admin deactivates ───────────
router.delete('/:id/customers/:customerId', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: serviceId, customerId } = req.params;
    await prisma.$executeRaw`
      UPDATE customer_services SET "isActive" = FALSE
      WHERE "customerId" = ${customerId} AND "serviceId" = ${serviceId}
    `;
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ─── POST /services/:id/request — customer requests a service ────────────────
router.post('/:id/request', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const customerId = req.user!.id;
    const serviceId = req.params.id;
    const { note } = z.object({ note: z.string().optional() }).parse(req.body);

    const svc = await prisma.$queryRaw<any[]>`SELECT id FROM services WHERE id = ${serviceId}`;
    if (!svc.length) return next(new AppError('Service not found', 404));

    const active = await prisma.$queryRaw<any[]>`
      SELECT id FROM customer_services
      WHERE "customerId" = ${customerId} AND "serviceId" = ${serviceId} AND "isActive" = TRUE
    `;
    if (active.length) return next(new AppError('Service already active for your account', 400));

    const pending = await prisma.$queryRaw<any[]>`
      SELECT id FROM service_requests
      WHERE "customerId" = ${customerId} AND "serviceId" = ${serviceId} AND status = 'pending'
    `;
    if (pending.length) return next(new AppError('You already have a pending request for this service', 400));

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO service_requests (id, "customerId", "serviceId", status, note, "createdAt", "updatedAt")
      VALUES (${id}, ${customerId}, ${serviceId}, 'pending', ${note ?? null}, NOW(), NOW())
    `;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM service_requests WHERE id = ${id}`;
    res.status(201).json({ success: true, data: { request: rows[0] } });
  } catch (error) { next(error); }
});

export default router;
