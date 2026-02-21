#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = ['compose', '-f', 'docker-compose.yml', 'down'];

const res = spawnSync('docker', args, { stdio: 'inherit' });

if (res.error) {
  if (res.error.code === 'ENOENT') {
    console.error('Docker is not installed or not on PATH.');
    console.error('If you are running Postgres locally (not via Docker), you can ignore db:down.');
    process.exit(1);
  }
  console.error('Failed to run docker compose:', res.error.message || res.error);
  process.exit(1);
}

process.exit(res.status ?? 0);
