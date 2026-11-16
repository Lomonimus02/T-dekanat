// pm2: сервис кабинета на сервере. Секреты читаются из .env рядом (не в репозитории).
module.exports = {
  apps: [{
    name: 'stellar-dekanat',
    cwd: '/opt/stellar-dekanat',
    script: 'dist/server.js',
    interpreter: '/usr/bin/node',
    node_args: '--env-file=/opt/stellar-dekanat/.env --max-old-space-size=160',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '220M',
    autorestart: true,
    restart_delay: 3000,
    exp_backoff_restart_delay: 200,
    out_file: '/opt/stellar-dekanat/logs/out.log',
    error_file: '/opt/stellar-dekanat/logs/err.log',
    time: true,
  }],
};
