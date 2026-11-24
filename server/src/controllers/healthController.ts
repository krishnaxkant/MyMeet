import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { checkSupabaseConnection } from '../config/supabase.js';

export const getHealth = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const supabase = await checkSupabaseConnection();
    const isDegraded = supabase.status === 'error';

    res.status(isDegraded ? 503 : 200).json({
      status: isDegraded ? 'degraded' : 'ok',
      service: 'meet-backend',
      version: '1.0.0',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      supabase,
    });
  } catch (error) {
    next(error);
  }
};

export const getSupabaseHealth = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const supabase = await checkSupabaseConnection();
    res.status(supabase.status === 'error' ? 503 : 200).json(supabase);
  } catch (error) {
    next(error);
  }
};
