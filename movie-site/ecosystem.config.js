module.exports = {
  apps: [{
    name: 'cinevault',
    script: 'server.js',
    instances: 'max',       // Use all 4 CPU cores
    exec_mode: 'cluster',    // Cluster mode for multi-device support
    max_memory_restart: '1G', // Auto-restart on memory leak
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    // Graceful restart — wait for streams to finish
    kill_timeout: 10000,
    listen_timeout: 10000,
    wait_ready: true,
    // Auto-restart on crash
    autorestart: true,
    max_restarts: 10,
    restart_delay: 4000,
    // Log rotation
    error_file: '/home/ghost/movie-site/logs/error.log',
    out_file: '/home/ghost/movie-site/logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};