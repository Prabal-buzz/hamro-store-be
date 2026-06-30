import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { findUserById, createUser, updateUser, deleteUser } from '../utils/users.js';
import { AppError } from '../utils/app-error.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import { VENDOR_CATEGORIES } from '../types/auth.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
const createUserSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    role: z.enum(['admin', 'customer', 'vendor']).default('customer'),
    category: z.enum(VENDOR_CATEGORIES).optional(),
});
const updateUserSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    name: z.string().min(1).optional(),
    status: z.enum(['active', 'inactive', 'suspended', 'pending']).optional(),
    category: z.enum(VENDOR_CATEGORIES).optional(),
});
const adminOrSelfMiddleware = (req, res, next) => {
    if (req.user?.role === 'admin' || req.user?.id === req.params.id)
        return next();
    return next(new AppError('Access denied.', 403));
};
// GET /users — list all users (admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const role = req.query.role;
        const status = req.query.status;
        const search = req.query.search;
        const where = {};
        if (role)
            where.role = role;
        if (status)
            where.status = status;
        if (search)
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: { id: true, email: true, name: true, role: true, status: true, dashboardUrl: true, category: true, createdAt: true },
            }),
            prisma.user.count({ where }),
        ]);
        res.json({ status: 'success', data: { users, total, page, limit, totalPages: Math.ceil(total / limit) } });
    }
    catch (error) {
        next(error);
    }
});
// GET /users/:id
router.get('/:id', authMiddleware, adminOrSelfMiddleware, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, email: true, name: true, role: true, status: true, dashboardUrl: true, category: true, createdAt: true },
        });
        if (!user)
            return next(new AppError('User not found', 404));
        res.json({ status: 'success', data: { user } });
    }
    catch (error) {
        next(error);
    }
});
// POST /users — create user (admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const validation = createUserSchema.safeParse(req.body);
        if (!validation.success)
            return next(new AppError(validation.error.errors.map(e => e.message).join(', '), 400));
        const { email, password, name, role, category } = validation.data;
        if (role === 'vendor' && !category)
            return next(new AppError('Category is required for vendor accounts', 400));
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing)
            return next(new AppError('Email already exists', 400));
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await createUser({ email, passwordHash, role, name, dashboardUrl: `/${role}/dashboard`, category });
        const { passwordHash: _, ...safe } = user;
        res.status(201).json({ status: 'success', data: { user: safe } });
    }
    catch (error) {
        next(error);
    }
});
// PUT /users/:id
router.put('/:id', authMiddleware, adminOrSelfMiddleware, async (req, res, next) => {
    try {
        const validation = updateUserSchema.safeParse(req.body);
        if (!validation.success)
            return next(new AppError(validation.error.errors.map(e => e.message).join(', '), 400));
        const existing = await findUserById(req.params.id);
        if (!existing)
            return next(new AppError('User not found', 404));
        const updates = { ...validation.data };
        if (updates.password) {
            updates.passwordHash = await bcrypt.hash(updates.password, 10);
            delete updates.password;
        }
        const user = await updateUser(req.params.id, updates);
        const { passwordHash: _, ...safe } = user;
        res.json({ status: 'success', data: { user: safe } });
    }
    catch (error) {
        next(error);
    }
});
// PUT /users/:id/approve
router.put('/:id/approve', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const user = await findUserById(req.params.id);
        if (!user)
            return next(new AppError('User not found', 404));
        if (user.status !== 'pending')
            return next(new AppError('User is not in a pending state', 400));
        const updated = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'active' } });
        const { passwordHash: _, ...safe } = updated;
        res.json({ status: 'success', data: { user: safe } });
    }
    catch (error) {
        next(error);
    }
});
// PUT /users/:id/reject
router.put('/:id/reject', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const user = await findUserById(req.params.id);
        if (!user)
            return next(new AppError('User not found', 404));
        if (user.status !== 'pending')
            return next(new AppError('User is not in a pending state', 400));
        const updated = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'suspended' } });
        const { passwordHash: _, ...safe } = updated;
        res.json({ status: 'success', data: { user: safe } });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /users/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const user = await findUserById(req.params.id);
        if (!user)
            return next(new AppError('User not found', 404));
        await deleteUser(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
export default router;
