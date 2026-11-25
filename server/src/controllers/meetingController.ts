import type { NextFunction, Request, Response } from 'express';
import {
  admitParticipant,
  createMeeting,
  endMeeting,
  getMeetingByCode,
  HttpError,
  issueMeetingMediaToken,
  joinMeeting,
  leaveMeeting,
  listUserMeetings,
  removeParticipant,
  updateMeetingSettings,
} from '../services/meetingService.js';

function handleControllerError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.statusCode === 403 ? 'Forbidden' : err.statusCode === 404 ? 'Not Found' : 'Error',
      message: err.message,
    });
    return;
  }
  next(err);
}

export const createMeetingHandler = async (
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
    const title = typeof body.title === 'string' ? body.title : undefined;
    const waitingRoomEnabled =
      typeof body.waiting_room_enabled === 'boolean' ? body.waiting_room_enabled : false;

    const meeting = await createMeeting(req.user, {
      title,
      waiting_room_enabled: waitingRoomEnabled,
    });

    res.status(201).json({ meeting });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const listMeetingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const meetings = await listUserMeetings(req.user.id);
    res.json({ meetings });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const getMeetingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const meeting = await getMeetingByCode(String(req.params.code ?? ''), req.user.id);
    res.json({ meeting });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const joinMeetingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const meeting = await joinMeeting(String(req.params.code ?? ''), req.user);
    res.json({ meeting });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const leaveMeetingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    await leaveMeeting(String(req.params.code ?? ''), req.user.id);
    res.json({ ok: true });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const updateMeetingSettingsHandler = async (
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
    const meeting = await updateMeetingSettings(String(req.params.code ?? ''), req.user.id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      is_locked: typeof body.is_locked === 'boolean' ? body.is_locked : undefined,
      waiting_room_enabled:
        typeof body.waiting_room_enabled === 'boolean' ? body.waiting_room_enabled : undefined,
    });

    res.json({ meeting });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const admitParticipantHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const meeting = await admitParticipant(
      String(req.params.code ?? ''),
      req.user.id,
      String(req.params.userId ?? ''),
    );
    res.json({ meeting });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const removeParticipantHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const meeting = await removeParticipant(
      String(req.params.code ?? ''),
      req.user.id,
      String(req.params.userId ?? ''),
    );
    res.json({ meeting });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const endMeetingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const meeting = await endMeeting(String(req.params.code ?? ''), req.user.id);
    res.json({ meeting });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const issueMeetingTokenHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const media = await issueMeetingMediaToken(String(req.params.code ?? ''), req.user);
    res.json(media);
  } catch (err) {
    handleControllerError(err, res, next);
  }
};
