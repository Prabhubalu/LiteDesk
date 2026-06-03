#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generate-load-perf-scenarios.mjs');
spawn('node', [script], { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 0));
