import { Router } from 'express';
import {
  createOrderHandler,
  getBillingStatusHandler,
  verifyPaymentHandler,
} from '../controllers/billingController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/status', getBillingStatusHandler);
router.post('/create-order', createOrderHandler);
router.post('/verify-payment', verifyPaymentHandler);

export default router;
