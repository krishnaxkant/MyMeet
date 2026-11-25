import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import deviceRoutes from './routes/deviceRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      name: 'Meet Backend API',
      version: '1.0.0',
      health: '/api/health',
      me: '/api/me',
      meetings: '/api/meetings',
      invitations: '/api/invitations',
      schedules: '/api/schedules',
      history: '/api/history',
      devices: '/api/devices',
    });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/me', profileRoutes);
  app.use('/api/meetings', meetingRoutes);
  app.use('/api/invitations', invitationRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/devices', deviceRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
