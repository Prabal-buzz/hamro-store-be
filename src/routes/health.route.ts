import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Get API health status
 *     description: Returns the health status of the backend API, uptime, and other diagnostics.
 *     responses:
 *       200:
 *         description: Successfully retrieved health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Backend API is running smoothly
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: '2026-06-25T16:01:14.000Z'
 *                 uptime:
 *                   type: number
 *                   example: 12.34
 *                 nodeVersion:
 *                   type: string
 *                   example: v24.8.0
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend API is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
  });
});

export default router;
