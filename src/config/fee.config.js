import { ConfigService } from '../modules/config/config.service.js';

// Centralizing campus bounds to ensure strict geospatial fencing
export const CAMPUS_CONFIG = {
  CENTER_LAT: 8.563, // Approx center of ASTU
  CENTER_LNG: 39.291,
  MAX_RADIUS_METERS: 1800000,
  ET_TIMEZONE_OFFSET: 3 * 60 * 60 * 1000 // UTC+3
};

/**
 * Dynamic fee helpers — reads from the in-memory config cache (O(1), no DB hit).
 * Falls back to sensible hardcoded defaults if cache hasn't been warmed yet.
 */
export const getPlatformFeePercent = () =>
  parseFloat(ConfigService.get('PLATFORM_FEE_PERCENT', '0.08'));

export const getMinDeliveryFee = () =>
  parseFloat(ConfigService.get('MIN_DELIVERY_FEE', '33.00'));

export const isMaintenanceMode = () =>
  ConfigService.get('MAINTENANCE_MODE', 'false') === 'true';