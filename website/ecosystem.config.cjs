/** @type {import("pm2").StartOptions} */
module.exports = {
  apps: [
    {
      name: "imposter-game",
      cwd: __dirname,
      script: "dist/server/index.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      min_uptime: "10s",
      restart_delay: 1000,
      kill_timeout: 15000,
      time: true,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
