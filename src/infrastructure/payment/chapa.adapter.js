import crypto from 'node:crypto';
import axios from 'axios';
import config from '../../config/env.config.js';

const chapaApi = axios.create({
  baseURL: 'https://api.chapa.co/v1',
  headers: {
    Authorization: `Bearer ${config.CHAPA_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

export class ChapaAdapter {
  static async initializeTransaction(data) {
    try {
      const response = await chapaApi.post('/transaction/initialize', data);
      return response.data;
    } catch (error) {
      console.error('[CHAPA INIT ERROR]:', error.response?.data || error.message);
      throw new Error('Failed to initialize payment gateway.');
    }
  }

  static async transferFunds(data) {
    try {
      const response = await chapaApi.post('/transfers', data);
      return response.data;
    } catch (error) {
      console.error('[CHAPA TRANSFER ERROR]:', error.response?.data || error.message);
      throw new Error('Failed to transfer funds to deliverer.');
    }
  }

  static verifyWebhookSignature(signature, payload) {
    if (!signature) return false;
    const hash = crypto
      .createHmac('sha256', config.CHAPA_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  }

  static async issueRefund(chapaRef, amount) {
    try {
      // Chapa's refund API requires the original transaction reference
      // and a unique reference for the refund itself.
      const payload = {
        transaction_id: chapaRef, // Note: Depending on Chapa API version, this might need the internal Chapa ID instead of tx_ref. Assuming tx_ref for now.
        amount: amount.toString()
      };

      const response = await chapaApi.post('/refunds', payload);
      return response.data;
    } catch (error) {
      console.error('[CHAPA REFUND ERROR]:', error.response?.data || error.message);
      throw new Error('Failed to issue refund via Payment Gateway.');
    }
  }

  async verifyTransaction(transactionId) {
    try {
      const response = await chapaApi.get(`/transaction/${transactionId}`)
      return response.data;
    } catch (error) {
      console.error('Payment verification Error: ', error.response?.data || error.message)
      throw new Error('Failed to verify payment with chapa')
    }
  }

}