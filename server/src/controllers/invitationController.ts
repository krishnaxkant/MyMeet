import type { NextFunction, Request, Response } from 'express';
import {
  createMeetingInvitation,
  listMeetingInvitations,
  listMyIncomingInvitations,
  respondToInvitation,
} from '../services/invitationService.js';
import { HttpError } from '../services/meetingService.js';

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: 'Error', message: err.message });
    return;
  }
  next(err);
}

export const createInvitationHandler = async (
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
    const email = typeof body.email === 'string' ? body.email : '';
    const { invitation, emailDelivery } = await createMeetingInvitation(
      String(req.params.code ?? ''),
      req.user,
      email,
    );
    res.status(201).json({ invitation, emailDelivery });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const listMeetingInvitationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const invitations = await listMeetingInvitations(String(req.params.code ?? ''), req.user.id);
    res.json({ invitations });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const listMyInvitationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }
    const invitations = await listMyIncomingInvitations(req.user);
    res.json({ invitations });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const respondToInvitationHandler = async (
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
    const action = body.action;
    if (action !== 'accepted' && action !== 'declined') {
      res.status(400).json({ error: 'Bad Request', message: 'action must be accepted or declined.' });
      return;
    }
    const invitation = await respondToInvitation(String(req.params.id ?? ''), req.user, action);
    res.json({ invitation });
  } catch (err) {
    handleErr(err, res, next);
  }
};
