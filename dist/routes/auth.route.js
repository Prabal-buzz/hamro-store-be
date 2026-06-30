import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { findUserByEmail, findUserById, createUser } from '../utils/users.js';
import { AppError } from '../utils/app-error.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { VENDOR_CATEGORIES } from '../types/auth.js';
const router = Router();
const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});
router.post('/login', async (req, res, next) => {
    try {
        const validation = loginSchema.safeParse(req.body);
        if (!validation.success) {
            return next(new AppError(validation.error.errors.map(e => e.message).join(', '), 400));
        }
        const { email, password } = validation.data;
        const user = await findUserByEmail(email);
        if (!user)
            return next(new AppError('Invalid email or password', 401));
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch)
            return next(new AppError('Invalid email or password', 401));
        if (user.status === 'pending')
            return next(new AppError('Your account is awaiting admin approval.', 403));
        if (user.status === 'suspended')
            return next(new AppError('Your account has been suspended.', 403));
        if (user.status === 'inactive')
            return next(new AppError('Your account is inactive.', 403));
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
        res.status(200).json({
            status: 'success',
            data: {
                token,
                user: { id: user.id, email: user.email, name: user.name, role: user.role },
                redirectUrl: user.dashboardUrl,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        if (!req.user)
            return next(new AppError('User not found in request context', 500));
        const user = await findUserById(req.user.id);
        if (!user)
            return next(new AppError('User not found', 404));
        res.status(200).json({
            status: 'success',
            data: {
                user: { id: user.id, email: user.email, name: user.name, role: user.role },
                redirectUrl: user.dashboardUrl,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
const registerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['customer', 'vendor']),
    category: z.enum(VENDOR_CATEGORIES).optional(),
});
router.post('/register', async (req, res, next) => {
    try {
        const validation = registerSchema.safeParse(req.body);
        if (!validation.success) {
            return next(new AppError(validation.error.errors.map(e => e.message).join(', '), 400));
        }
        const { name, email, password, role, category } = validation.data;
        if (role === 'vendor' && !category)
            return next(new AppError('Category is required for vendor accounts', 400));
        const existing = await findUserByEmail(email);
        if (existing)
            return next(new AppError('An account with this email already exists', 400));
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await createUser({
            email, passwordHash, role, name,
            dashboardUrl: `/${role}/dashboard`,
            category,
        });
        // Newly registered users start as pending until admin approves
        const { prisma } = await import('../lib/prisma.js');
        await prisma.user.update({ where: { id: newUser.id }, data: { status: 'pending' } });
        res.status(201).json({
            success: true,
            message: 'Registration successful. Your account is pending admin approval.',
            data: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
