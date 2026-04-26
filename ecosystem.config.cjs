module.exports = {
  apps: [
    {
      name: 'el-sakka-store',
      script: 'npm',
      args: 'run start:prod',
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
