import type { NextFunction, Request, Response } from 'express';
import { getMeetingHistoryDetail, listMeetingHistory } from '../services/historyService.js';
import { HttpError } from '../services/meetingService.js';

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: 'Error', message: err.message });
    return;
  }
  next(err);
}

export const listHistoryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const history = await listMeetingHistory(req.user.id);
    res.json({ history });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const getHistoryDetailHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const detail = await getMeetingHistoryDetail(String(req.params.code ?? ''), req.user.id);
    res.json({ detail });
  } catch (err) {
    handleErr(err, res, next);
  }
};
