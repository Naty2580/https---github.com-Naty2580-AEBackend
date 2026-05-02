import crypto from 'node:crypto';
import config from '../../config/env.config.js';

export class TelegramAdapter {
  /**
   * Verifies the cryptographic integrity of the WebApp initData payload.
   * Based on Telegram's official validation algorithm.
   */
  static verifyInitData(telegramInitData) {
    const urlParams = new URLSearchParams(telegramInitData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      throw new Error('Telegram payload is missing hash signature');
    }

    // Remove hash from the data to generate the data-check-string
    urlParams.delete('hash');
    
    // Sort parameters alphabetically
    const keys = Array.from(urlParams.keys()).sort();
    const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

    // 1. Create secret key from bot token
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.TELEGRAM_BOT_TOKEN).digest();
    
    // 2. Hash the data-check-string using the secret key
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // 3. Validate time (Prevent replay attacks if payload is older than 24h)
    const authDate = parseInt(urlParams.get('auth_date'), 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authDate > 86400) {
      throw new Error('Telegram payload has expired');
    }

    if (calculatedHash !== hash) {
      throw new Error('Telegram payload signature is invalid');
    }

    // Return the extracted user data
    const userStr = urlParams.get('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}