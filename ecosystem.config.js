module.exports = {
  apps: [
    {
      name: "eit-pass-scan-backend",
      cwd: "/var/www/eit-pass-scan-app/backend",
      script: "src/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3012,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "/var/www/eit-pass-scan-app/backend/logs/error.log",
      out_file: "/var/www/eit-pass-scan-app/backend/logs/out.log",
      time: true,
    },
    {
      // serves the built frontend (dist/) as static files, on port 5544 —
      // needs the "serve" package available (npx pulls it on first run,
      // or install it globally: npm install -g serve)
      name: "eit-pass-scan-frontend",
      cwd: "/var/www/eit-pass-scan-app/frontend",
      script: "npx",
      args: "serve -s dist -l 5544",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      error_file: "/var/www/eit-pass-scan-app/frontend/logs/error.log",
      out_file: "/var/www/eit-pass-scan-app/frontend/logs/out.log",
      time: true,
    },
  ],
};