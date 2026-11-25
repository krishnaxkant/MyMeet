import type { NextFunction, Request, Response } from 'express';
import { listMeetingMessages, sendMeetingMessage } from '../services/chatService.js';
import { HttpError } from '../services/meetingService.js';

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: 'Error', message: err.message });
    return;
  }
  next(err);
}

export const listMessagesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const messages = await listMeetingMessages(String(req.params.code ?? ''), req.user.id);
    res.json({ messages });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const sendMessageHandler = async (
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
    const content = typeof body.content === 'string' ? body.content : '';
    const message = await sendMeetingMessage(String(req.params.code ?? ''), req.user, content);
    res.status(201).json({ message });
  } catch (err) {
    handleErr(err, res, next);
  }
};
