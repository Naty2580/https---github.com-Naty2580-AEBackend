import { isMaintenanceMode } from '../../config/fee.config.js';

/**
 * Global Maintenance Mode Interceptor.
 *
 * When MAINTENANCE_MODE config is set to "true" via the Admin Dashboard,
 * this middleware blocks ALL API requests with a 503 response,
 * EXCEPT for:
 *  - Admin routes (so admins can still log in and turn off maintenance)
 *  - The /health endpoint (for load balancers and uptime monitors)
 */
export const maintenanceModeMiddleware = (req, res, next) => {
  if (!isMaintenanceMode()) return next();

  // Always allow admins and health checks through
  const isAdminRoute = req.path.startsWith('/users/login') || req.path.startsWith('/auth');
  const isHealthCheck = req.path === '/health';

  if (isAdminRoute || isHealthCheck) return next();

  return res.status(503).json({
    success: false,
    message: 'The platform is currently under maintenance. We will be back shortly.',
    code: 'MAINTENANCE_MODE'
  });
};
