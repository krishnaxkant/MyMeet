import type { NextFunction, Request, Response } from 'express';
import {
  listUserDevices,
  registerUserDevice,
  removeUserDevice,
  type DevicePlatform,
} from '../services/deviceService.js';
import { HttpError } from '../services/meetingService.js';

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: 'Error', message: err.message });
    return;
  }
  next(err);
}

export const registerDeviceHandler = async (
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
    const platform = body.platform;
    const pushToken = body.push_token;
    const deviceName = typeof body.device_name === 'string' ? body.device_name : null;

    if (platform !== 'android' && platform !== 'web' && platform !== 'ios') {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid device platform.' });
      return;
    }
    if (typeof pushToken !== 'string' || !pushToken.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'push_token is required.' });
      return;
    }

    const device = await registerUserDevice(req.user, {
      platform: platform as DevicePlatform,
      push_token: pushToken,
      device_name: deviceName,
    });
    res.status(201).json({ device });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const listDevicesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const devices = await listUserDevices(req.user.id);
    res.json({ devices });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const deleteDeviceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    await removeUserDevice(req.user.id, String(req.params.id ?? ''));
    res.json({ ok: true });
  } catch (err) {
    handleErr(err, res, next);
  }
};
