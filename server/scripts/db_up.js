#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = ['compose', '-f', 'docker-compose.yml', 'up', '-d'];

const res = spawnSync('docker', args, { stdio: 'inherit' });

if (res.error) {
  if (res.error.code === 'ENOENT') {
    console.error('Docker is not installed or not on PATH.');
    console.error('To run Postgres via Docker: install Docker Desktop / Engine, then re-run: npm run db:up');
    console.error('Alternatively: install Postgres locally and set DATABASE_URL in server/.env before running: npm run db:init');
    process.exit(1);
  }
  console.error('Failed to run docker compose:', res.error.message || res.error);
  process.exit(1);
}

process.exit(res.status ?? 0);
