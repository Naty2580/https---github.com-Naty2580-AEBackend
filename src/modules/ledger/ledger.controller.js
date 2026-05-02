import { LedgerService } from './ledger.service.js';
const ledgerService = new LedgerService();

export const getMyLedger = async (req, res, next) => {
  try {
    // For Deliverers: View their earnings
    const result = await ledgerService.getUserLedger(req.user.id, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getPlatformLedger = async (req, res, next) => {
  try {
    // For Admins: View platform revenue and escrow balances
    const result = await ledgerService.getPlatformLedger(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};