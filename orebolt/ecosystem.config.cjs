// orebolt — live mining dashboard demo (pm2, Dell)
module.exports = {
  apps: [{
    name: 'orebolt',
    script: 'serve.js',
    env: { PORT: '8214', NODE_ENV: 'production' },
    max_memory_restart: '200M',
    autorestart: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
