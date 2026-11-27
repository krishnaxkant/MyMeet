import type { NextFunction, Request, Response } from 'express';
import {
  createCheckoutOrder,
  getUserSubscriptionStatus,
  ORDERED_PLANS,
  type PaidPlanCode,
  verifyCheckoutOrder,
} from '../services/billingService.js';
import { HttpError } from '../services/meetingService.js';

const PAID_PLAN_CODES: PaidPlanCode[] = [
  'single_9',
  'pack_49',
  'pro_monthly_349',
  'pro_yearly_899',
];

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: 'Error', message: err.message });
    return;
  }
  next(err);
}

export const getBillingStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const subscription = await getUserSubscriptionStatus(req.user.id);
    res.json({
      subscription,
      plans: ORDERED_PLANS,
    });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const createOrderHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawPlan = typeof body.plan_code === 'string' ? body.plan_code.trim() : '';
    if (!PAID_PLAN_CODES.includes(rawPlan as PaidPlanCode)) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid plan_code.' });
      return;
    }
    const meetingCode = typeof body.meeting_code === 'string' ? body.meeting_code : undefined;

    const order = await createCheckoutOrder(req.user.id, rawPlan as PaidPlanCode, meetingCode);
    res.status(201).json({ order });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const verifyPaymentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
    if (!orderId) {
      res.status(400).json({ error: 'Bad Request', message: 'order_id is required.' });
      return;
    }

    const result = await verifyCheckoutOrder(req.user.id, {
      order_id: orderId,
      razorpay_order_id:
        typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : undefined,
      razorpay_payment_id:
        typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : undefined,
      razorpay_signature:
        typeof body.razorpay_signature === 'string' ? body.razorpay_signature : undefined,
    });
    res.json(result);
  } catch (err) {
    handleErr(err, res, next);
  }
};
