import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { seedUsers } from '../utils/users.js';
import { AppError } from '../utils/app-error.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { AuthenticatedRequest } from '../types/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate user
 *     description: Authenticates user credentials and returns a JWT token along with dashboard redirection URL based on user role (admin, customer, vendor).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@hamrostore.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: user-admin-1
 *                         email:
 *                           type: string
 *                           example: admin@hamrostore.com
 *                         name:
 *                           type: string
 *                           example: Admin User
 *                         role:
 *                           type: string
 *                           example: admin
 *                     redirectUrl:
 *                       type: string
 *                       example: /admin/dashboard
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid email or password
 */
router.post('/login', async (req, res, next) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      const messages = validation.error.errors.map(err => err.message).join(', ');
      return next(new AppError(messages, 400));
    }

    const { email, password } = validation.data;

    const user = seedUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return next(new AppError('Invalid email or password', 401));
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        redirectUrl: user.dashboardUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     description: Decodes JWT Bearer token and returns authenticated user profile and redirect URL.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: user-admin-1
 *                         email:
 *                           type: string
 *                           example: admin@hamrostore.com
 *                         name:
 *                           type: string
 *                           example: Admin User
 *                         role:
 *                           type: string
 *                           example: admin
 *                     redirectUrl:
 *                       type: string
 *                       example: /admin/dashboard
 *       401:
 *         description: Unauthorized (Invalid or missing Bearer token)
 */
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!req.user) {
      return next(new AppError('User not found in request context', 500));
    }

    const user = seedUsers.find(u => u.id === req.user?.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        redirectUrl: user.dashboardUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
