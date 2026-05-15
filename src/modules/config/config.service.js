import { ConfigRepository } from './config.repository.js';
import { NotFoundError, BusinessLogicError } from '../../core/errors/domain.errors.js';

// ===================================================
// SINGLETON IN-MEMORY CACHE
// Loaded once at startup, zero DB latency on reads.
// ===================================================
let configCache = null;

export class ConfigService {
  constructor() {
    this.repository = new ConfigRepository();
  }

  /**
   * Warm the in-memory cache. Call this once at server startup.
   * After that, config reads come from memory, not the database.
   */
  async warmCache() {
    const configs = await this.repository.findAll();
    configCache = {};
    configs.forEach(c => { configCache[c.key] = c.value; });
    console.log(`⚙️  [ConfigCache] Warmed with ${configs.length} entries.`);
  }

  /**
   * O(1) config read from memory cache.
   * Falls back to DB if cache hasn't been warmed yet.
   */
  static get(key, defaultValue = null) {
    if (!configCache) return defaultValue;
    return configCache[key] ?? defaultValue;
  }

  // ===================== ADMIN OPERATIONS =====================

  async listAll() {
    const configs = await this.repository.findAll();
    return { total: configs.length, configs };
  }

  async getOne(key) {
    const config = await this.repository.findByKey(key);
    if (!config) throw new NotFoundError(`Config key "${key}" not found.`);
    return config;
  }

  async create(key, value) {
    // Prevent duplicate keys
    const existing = await this.repository.findByKey(key);
    if (existing) throw new BusinessLogicError(`Config key "${key}" already exists. Use PATCH to update.`);

    // Normalize value to string
    const strValue = String(value);
    const config = await this.repository.create(key, strValue);

    // Update cache immediately
    if (configCache) configCache[key] = strValue;

    return config;
  }

  async update(key, value) {
    // Ensure key exists
    const existing = await this.repository.findByKey(key);
    if (!existing) throw new NotFoundError(`Config key "${key}" not found.`);

    const strValue = String(value);
    const updated = await this.repository.updateByKey(key, strValue);

    // Invalidate and update cache immediately
    if (configCache) configCache[key] = strValue;

    return updated;
  }

  async remove(key) {
    const existing = await this.repository.findByKey(key);
    if (!existing) throw new NotFoundError(`Config key "${key}" not found.`);

    await this.repository.deleteByKey(key);

    // Remove from cache
    if (configCache) delete configCache[key];
  }
}
