import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { seedUsers, User } from '../utils/users.js';
import { AppError } from '../utils/app-error.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { AuthenticatedRequest, UserRole } from '../types/auth.js';

const router = Router();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'customer', 'vendor']).default('customer'),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['admin', 'customer', 'vendor']).optional(),
});

// Middleware to check if user is admin
const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (req.user?.role !== 'admin') {
    return next(new AppError('Access denied. Admin only.', 403));
  }
  next();
};

// Middleware to check if user is admin or accessing own data
const adminOrSelfMiddleware = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (req.user?.role === 'admin' || req.user?.id === req.params.id) {
    return next();
  }
  return next(new AppError('Access denied. You can only access your own data.', 403));
};

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Returns a list of all users with filtering, sorting, and pagination (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, customer, vendor]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, email, role, status, createdAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Successfully retrieved users
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
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           email:
 *                             type: string
 *                           name:
 *                             type: string
 *                           role:
 *                             type: string
 *                           dashboardUrl:
 *                             type: string
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       403:
 *         description: Access denied
 */
router.get('/', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Get query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const role = req.query.role as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Start with all users (without password hashes)
    let filteredUsers = seedUsers.map(({ passwordHash, ...user }) => user);

    // Apply filters
    if (role) {
      filteredUsers = filteredUsers.filter(u => u.role === role);
    }

    if (status) {
      filteredUsers = filteredUsers.filter(u => u.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(u => 
        u.name.toLowerCase().includes(searchLower) || 
        u.email.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filteredUsers.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'name' || sortBy === 'email' || sortBy === 'role' || sortBy === 'status') {
        comparison = a[sortBy].localeCompare(b[sortBy]);
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Calculate pagination
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    res.status(200).json({
      status: 'success',
      data: {
        users: paginatedUsers,
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Returns a specific user by ID (Admin or own user only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved user
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */
router.get('/:id', authMiddleware, adminOrSelfMiddleware, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = seedUsers.find(u => u.id === req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const { passwordHash, ...userWithoutPassword } = user;
    res.status(200).json({
      status: 'success',
      data: { user: userWithoutPassword },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a new user
 *     description: Creates a new user (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, customer, vendor]
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 */
router.post('/', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      const messages = validation.error.errors.map(err => err.message).join(', ');
      return next(new AppError(messages, 400));
    }

    const { email, password, name, role } = validation.data;

    // Check if email already exists
    const existingUser = seedUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return next(new AppError('Email already exists', 400));
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate ID and dashboard URL based on role
    const id = `user-${role}-${Date.now()}`;
    const dashboardUrl = `/${role}/dashboard`;

    const newUser: User = {
      id,
      email,
      passwordHash,
      role,
      name,
      dashboardUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    seedUsers.push(newUser);

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      status: 'success',
      data: { user: userWithoutPassword },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Update user
 *     description: Updates a user by ID (Admin or own user only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, customer, vendor]
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */
router.put('/:id', authMiddleware, adminOrSelfMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      const messages = validation.error.errors.map(err => err.message).join(', ');
      return next(new AppError(messages, 400));
    }

    const userIndex = seedUsers.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return next(new AppError('User not found', 404));
    }

    const user = seedUsers[userIndex];
    const updates = validation.data;

    // Non-admins cannot change their role
    if (req.user?.role !== 'admin' && updates.role && updates.role !== user.role) {
      return next(new AppError('You cannot change your role', 403));
    }

    // Update email if provided and not already taken
    if (updates.email && updates.email.toLowerCase() !== user.email.toLowerCase()) {
      const emailExists = seedUsers.find(u => u.email.toLowerCase() === updates.email!.toLowerCase() && u.id !== user.id);
      if (emailExists) {
        return next(new AppError('Email already exists', 400));
      }
      user.email = updates.email;
    }

    // Update other fields
    if (updates.name) user.name = updates.name;
    if (updates.role) {
      user.role = updates.role as UserRole;
      user.dashboardUrl = `/${updates.role}/dashboard`;
    }
    if (updates.password) {
      user.passwordHash = await bcrypt.hash(updates.password, 10);
    }

    const { passwordHash, ...userWithoutPassword } = user;
    res.status(200).json({
      status: 'success',
      data: { user: userWithoutPassword },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Deletes a user by ID (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */
router.delete('/:id', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userIndex = seedUsers.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return next(new AppError('User not found', 404));
    }

    seedUsers.splice(userIndex, 1);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
