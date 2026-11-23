module.exports = {
  apps: [{
    name: 'orebolt-real',
    script: 'server.js',
    env: { PORT: '8215', NODE_ENV: 'production' },
    max_memory_restart: '200M',
    autorestart: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
