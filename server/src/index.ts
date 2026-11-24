import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.port, '0.0.0.0', () => {
  console.log(`[meet-backend] Running on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[meet-backend] LAN access enabled on 0.0.0.0:${env.port}`);
  console.log(`[meet-backend] Health check: http://localhost:${env.port}/api/health`);
});
