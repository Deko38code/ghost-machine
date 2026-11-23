// mockminer — Bitcoin mining dashboard demo (pm2)
module.exports = {
  apps: [{
    name: 'mockminer',
    script: 'serve.js',
    env: { PORT: '8213', NODE_ENV: 'production' },
    max_memory_restart: '200M',
    autorestart: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
