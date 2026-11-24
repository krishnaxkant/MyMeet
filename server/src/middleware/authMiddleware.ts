import type { NextFunction, Request, Response } from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header.',
      });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token is required.',
      });
      return;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Supabase authentication is not configured on the backend.',
      });
      return;
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired access token.',
      });
      return;
    }

    const rawFullName = data.user.user_metadata?.full_name;
    req.user = {
      id: data.user.id,
      email: data.user.email ?? '',
      fullName: typeof rawFullName === 'string' ? rawFullName : undefined,
    };

    next();
  } catch (err) {
    next(err);
  }
};
