import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/healthRoutes.js';
import profileRoutes from './routes/profileRoutes.js';

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
    });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/me', profileRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
