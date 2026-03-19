import crypto from 'node:crypto';
import config from '../../config/env.config.js';

export const verifyChapaSignature = (signature, payload) => {
  const hash = crypto
    .createHmac('sha256', config.CHAPA_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
};