import crypto from 'node:crypto';
import axios from 'axios';
import config from '../../config/env.config.js';


const chapaApi = axios.create({
  baseURL: 'https://api.chapa.co/v1',
  headers: {
    Authorization: `Bearer ${config.CHAPA_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
})


export const chapaAdapter = {

  async initializeTransaction(data) {
    try {
      const response = await chapaApi.post('/transaction/initialize', data)
      return response.data;
    } catch (error) {
      console.error('Payment initialization Error: ', error.response?.data || error.message)
      throw new Error('Failed to initialize payment with chapa')
    }
  },

  async verifyTransaction(transactionId) {
    try {
      const response = await chapaApi.get(`/transaction/${transactionId}`)
      return response.data;
    } catch (error) {
      console.error('Payment verification Error: ', error.response?.data || error.message)
      throw new Error('Failed to verify payment with chapa')
    }
  },

  async transferFunds(data) {
    try {
      const response = await chapaApi.post('/transfers', data)
      return response.data;
    } catch (error) {
      console.error('Transfer Error: ', error.response?.data || error.message)
      throw new Error('Failed to transfer funds with chapa')
    }
  },

  verifyWebhookSignature(signature, payload) {
    const hash = crypto
      .createHmac('sha256', config.CHAPA_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return hash === signature;
  }
}

