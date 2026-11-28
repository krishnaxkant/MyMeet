import type { NextFunction, Request, Response } from 'express';
import {
  analyzeAndStoreScreenFrame,
  generateMeetingAiSummaryForUser,
  getOrGenerateMeetingMcqsForUser,
  recordMeetingMcqAttemptForUser,
  recordMeetingTranscript,
  transcribeAndStoreAudioChunk,
  upgradeMeetingToProNotesForUser,
} from '../services/aiAgentService.js';
import { HttpError } from '../services/meetingService.js';

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: 'Error', message: err.message });
    return;
  }
  next(err);
}

export const recordTranscriptHandler = async (
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
    const speakerName = typeof body.speaker_name === 'string' ? body.speaker_name : undefined;

    const result = await recordMeetingTranscript(
      String(req.params.code ?? ''),
      req.user,
      content,
      speakerName,
    );
    res.status(201).json(result);
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const analyzeScreenFrameHandler = async (
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
    const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64 : '';
    const mimeType = typeof body.mime_type === 'string' ? body.mime_type : 'image/jpeg';
    const sharerName = typeof body.sharer_name === 'string' ? body.sharer_name : undefined;

    const result = await analyzeAndStoreScreenFrame(String(req.params.code ?? ''), req.user, {
      imageBase64,
      mimeType,
      sharerName,
    });
    res.status(201).json(result);
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const transcribeAudioChunkHandler = async (
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
    const audioBase64 = typeof body.audio_base64 === 'string' ? body.audio_base64 : '';
    const mimeType = typeof body.mime_type === 'string' ? body.mime_type : 'audio/webm';
    const speakerName = typeof body.speaker_name === 'string' ? body.speaker_name : undefined;

    const result = await transcribeAndStoreAudioChunk(String(req.params.code ?? ''), req.user, {
      audioBase64,
      mimeType,
      speakerName,
    });
    res.status(201).json(result);
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const generateAiSummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const summary = await generateMeetingAiSummaryForUser(
      String(req.params.code ?? ''),
      req.user.id,
    );
    res.json({ summary });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const upgradeProNotesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const result = await upgradeMeetingToProNotesForUser(
      String(req.params.code ?? ''),
      req.user.id,
    );
    res.json(result);
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const generateMeetingMcqsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
      return;
    }

    const quiz = await getOrGenerateMeetingMcqsForUser(
      String(req.params.code ?? ''),
      req.user.id,
    );
    res.json({ quiz });
  } catch (err) {
    handleErr(err, res, next);
  }
};

export const recordMeetingMcqAttemptHandler = async (
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
    const status = body.status === 'completed' ? 'completed' : 'in_progress';
    const attemptedCount = typeof body.attempted_count === 'number' ? body.attempted_count : 0;
    const correctCount = typeof body.correct_count === 'number' ? body.correct_count : 0;
    const totalQuestions = typeof body.total_questions === 'number' ? body.total_questions : 20;

    const result = await recordMeetingMcqAttemptForUser(String(req.params.code ?? ''), req.user.id, {
      status,
      attempted_count: attemptedCount,
      correct_count: correctCount,
      total_questions: totalQuestions,
    });
    res.json(result);
  } catch (err) {
    handleErr(err, res, next);
  }
};
