import crypto from 'node:crypto';
import config from '../../config/env.config.js';

export const verifyChapaSignature = (signature, payload) => {
  const hash = crypto
    .createHmac('sha256', config.CHAPA_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
};

/**
 * NEW: Initiates a payment session with Chapa.
 * Simulates the Chapa API response for local development.
 */
export const initiateChapaPayment = async (orderData) => {
  const tx_ref = `CHAPA-${orderData.shortId}-${Date.now()}`;

  // In production, this would be an axios.post to 'https://api.chapa.co/v1/transaction/initialize'
  console.log(`💳 [CHAPA] Initiating payment for Order ${orderId}. Amount: ${orderData.amount} ETB`);

  // Simulate Chapa Response
  return {
    success: true,
    tx_ref,
    checkout_url: `https://checkout.chapa.co/checkout/test-payment/${tx_ref}`
  };
};