module.exports = {
  apps: [
    {
      name: 'mymeet-api',
      cwd: __dirname,
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '420M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
