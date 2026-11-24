import type { NextFunction, Request, Response } from 'express';
import { getOrCreateProfile, updateUserProfile } from '../services/profileService.js';

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const profile = await getOrCreateProfile(req.user.id, req.user.email, req.user.fullName);
    res.json({ profile });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const fullName = body.full_name;
    const avatarUrl = body.avatar_url;

    if (fullName !== undefined && fullName !== null && typeof fullName !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'full_name must be a string.' });
      return;
    }

    if (typeof fullName === 'string' && fullName.trim().length > 100) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'full_name must be 100 characters or fewer.',
      });
      return;
    }

    if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'avatar_url must be a string.' });
      return;
    }

    if (typeof avatarUrl === 'string' && avatarUrl.trim().length > 0 && !isValidHttpUrl(avatarUrl.trim())) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'avatar_url must be a valid http or https URL.',
      });
      return;
    }

    const profile = await updateUserProfile(req.user.id, req.user.email, {
      full_name: fullName as string | null | undefined,
      avatar_url: avatarUrl as string | null | undefined,
    });

    res.json({ profile });
  } catch (error) {
    next(error);
  }
};
