import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../services/meetingService.js';
import {
  createScheduledMeeting,
  deleteScheduledMeeting,
  listScheduledMeetings,
  startScheduledMeeting,
} from '../services/scheduleService.js';

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: 'Error', message: err.message });
    return;
  }
  next(err);
}

export const createScheduleHandler = async (
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
    const inviteEmails = Array.isArray(body.invite_emails)
      ? body.invite_emails.filter((v): v is string => typeof v === 'string')
      : [];

    const result = await createScheduledMeeting(req.user, {
      title: typeof body.title === 'string' ? body.title : '',
      description: typeof body.description === 'string' ? body.description : null,
      scheduled_start: typeof body.scheduled_start === 'string' ? body.scheduled_start : '',
      scheduled_end: typeof body.scheduled_end === 'string' ? body.scheduled_end : '',
      timezone: typeof body.timezone === 'string' ? body.timezone : 'UTC',
      waiting_room_enabled: Boolean(body.waiting_room_enabled),
      invite_emails: inviteEmails,
    });

    res.status(201).json(result);
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const listSchedulesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const schedules = await listScheduledMeetings(req.user);
    res.json({ schedules });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const startScheduleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const schedule = await startScheduledMeeting(String(req.params.id ?? ''), req.user.id);
    res.json({ schedule });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const deleteScheduleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    await deleteScheduledMeeting(String(req.params.id ?? ''), req.user.id);
    res.json({ ok: true });
  } catch (err) {
    handleErr(err, res, next);
  }
};
