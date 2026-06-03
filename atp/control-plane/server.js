import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { v4 as uuidv4 } from 'uuid';
import { TestRun } from './models/TestRun.js';
import { Schedule } from './models/Schedule.js';
import { getConfig } from '../shared/config.mjs';
import { evaluateGoNoGo } from './lib/goNoGo.mjs';
import { buildReportHtml, buildCompareHtml } from './lib/reportHtml.mjs';
import { compareRuns } from './lib/runCompare.mjs';
import { registerSchedule, unregisterSchedule } from './scheduler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '../catalog/index.json');
const SUITES_PATH = path.join(__dirname, '../catalog/suites.json');

/** @type {Map<string, object>|null} */
let catalogDocById = null;

function getCatalogDocById() {
  if (catalogDocById) return catalogDocById;
  if (!fs.existsSync(CATALOG_PATH)) return new Map();
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  catalogDocById = new Map(
    (catalog.entries || []).map((e) => [e.id, e.documentation || null])
  );
  return catalogDocById;
}

function hydrateRunDocumentation(run) {
  if (!run?.results?.length) return run;
  const docs = getCatalogDocById();
  run.results = run.results.map((r) => {
    if (r.documentation) return r;
    const doc = docs.get(r.caseId);
    return doc ? { ...r, documentation: doc } : r;
  });
  return run;
}

const config = getConfig();
const app = express();

/** @type {Map<string, Set<import('express').Response>>} */
const runStreams = new Map();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

function authMiddleware(req, res, next) {
  if (req.path === '/atp/health' || req.path === '/health') return next();
  const key =
    req.headers['x-atp-api-key'] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.query.key;
  if (key !== config.apiKey) {
    return res.status(401).json({ success: false, message: 'Invalid ATP API key' });
  }
  next();
}

app.use('/atp', authMiddleware);

function broadcastRun(runId, payload) {
  const set = runStreams.get(runId);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    res.write(data);
  }
}

app.get('/atp/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'arivu-test-platform',
    mongo: mongoose.connection.readyState === 1,
  });
});

app.get('/health', (_req, res) => {
  res.redirect('/atp/health');
});

app.get('/atp/catalog', (_req, res) => {
  if (!fs.existsSync(CATALOG_PATH)) {
    return res.status(503).json({ success: false, message: 'Catalog not synced' });
  }
  res.json(JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')));
});

app.get('/atp/catalog/:caseId', (req, res) => {
  if (!fs.existsSync(CATALOG_PATH)) {
    return res.status(503).json({ success: false, message: 'Catalog not synced' });
  }
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const entry = catalog.entries?.find((e) => e.id === req.params.caseId);
  if (!entry) {
    return res.status(404).json({ success: false, message: 'Case not found' });
  }
  res.json({ success: true, entry });
});

app.get('/atp/suites', (_req, res) => {
  if (!fs.existsSync(SUITES_PATH)) {
    return res.status(503).json({ success: false, message: 'Suites missing' });
  }
  res.json(JSON.parse(fs.readFileSync(SUITES_PATH, 'utf8')));
});

app.get('/atp/runs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const runs = await TestRun.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, runs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/atp/runs/compare', async (req, res) => {
  try {
    const { runA, runB, format } = req.query;
    if (!runA || !runB) {
      return res.status(400).json({ success: false, message: 'runA and runB query params required' });
    }
    const a = await TestRun.findOne({ runId: runA }).lean();
    const b = await TestRun.findOne({ runId: runB }).lean();
    if (!a || !b) return res.status(404).json({ success: false, message: 'Run not found' });
    const diff = compareRuns(a, b);
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(buildCompareHtml(a, b));
    }
    res.json({ success: true, diff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/atp/runs/:runId/report', async (req, res) => {
  try {
    const run = await TestRun.findOne({ runId: req.params.runId }).lean();
    if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
    const template = req.query.template === 'sprint' ? 'sprint' : 'executive';
    let history = [];
    if (template === 'sprint') {
      history = await TestRun.find({ suiteKey: run.suiteKey, runId: { $ne: run.runId } })
        .sort({ finishedAt: -1 })
        .limit(8)
        .lean();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildReportHtml(run, template, history));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/atp/runs/:runId', async (req, res) => {
  try {
    const run = await TestRun.findOne({ runId: req.params.runId }).lean();
    if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
    res.json({ success: true, run: hydrateRunDocumentation(run) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/atp/runs/:runId/stream', (req, res) => {
  const { runId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!runStreams.has(runId)) runStreams.set(runId, new Set());
  runStreams.get(runId).add(res);

  req.on('close', () => {
    runStreams.get(runId)?.delete(res);
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', runId })}\n\n`);
});

app.post('/atp/runs', async (req, res) => {
  try {
    const { suiteKey, envKey = 'local', dryRun = false, triggeredBy = 'dashboard', results, status, stats, runId: bodyRunId } = req.body;
    const runId = bodyRunId || uuidv4();

    let existing = await TestRun.findOne({ runId });
    if (existing && results) {
      existing.results = results;
      existing.status = status || existing.status;
      existing.stats = stats || existing.stats;
      if (status === 'passed' || status === 'failed' || status === 'partial') {
        existing.finishedAt = new Date();
      }
      await existing.save();
      broadcastRun(runId, { type: 'run-update', run: existing.toObject() });
      return res.json({ success: true, run: existing.toObject() });
    }

    const suites = fs.existsSync(SUITES_PATH) ? JSON.parse(fs.readFileSync(SUITES_PATH, 'utf8')) : {};
    const suite = suites[suiteKey] || { name: suiteKey };

    const run = await TestRun.create({
      runId,
      suiteKey,
      suiteName: suite.name,
      envKey,
      dryRun,
      triggeredBy,
      sutApiUrl: config.sutApiUrl,
      status: dryRun ? 'passed' : 'queued',
      stats: stats || { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0 },
      results: results || [],
      startedAt: new Date(),
    });

    broadcastRun(runId, { type: 'run-created', run: run.toObject() });
    res.status(201).json({ success: true, run: run.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Create run + execute suite (inline or Bull queue) */
app.post('/atp/runs/execute', async (req, res) => {
  try {
    const { suiteKey, envKey = 'local', dryRun = false, triggeredBy = 'dashboard' } = req.body;
    if (!suiteKey) {
      return res.status(400).json({ success: false, message: 'suiteKey required' });
    }

    const runId = uuidv4();
    const suites = fs.existsSync(SUITES_PATH) ? JSON.parse(fs.readFileSync(SUITES_PATH, 'utf8')) : {};
    const suite = suites[suiteKey] || { name: suiteKey };

    await TestRun.create({
      runId,
      suiteKey,
      suiteName: suite.name,
      envKey,
      dryRun,
      triggeredBy,
      sutApiUrl: config.sutApiUrl,
      status: 'queued',
      stats: { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0 },
      results: [],
      startedAt: new Date(),
    });

    const { enqueueRun } = await import('./queue.mjs');
    const { inline } = await enqueueRun({ runId, suiteKey, envKey, dryRun, triggeredBy });

    if (inline) {
      res.status(202).json({ success: true, runId, mode: 'inline', message: 'Execution started' });
      setImmediate(async () => {
        try {
          const { executeRunJob } = await import('./runExecutor.mjs');
          await executeRunJob({ runId, suiteKey, envKey, dryRun, triggeredBy });
        } catch (err) {
          console.error('[ATP] Inline execute failed:', err);
          const run = await TestRun.findOne({ runId });
          if (run) {
            run.status = 'failed';
            run.finishedAt = new Date();
            await run.save();
            broadcastRun(runId, { type: 'run-update', run: run.toObject() });
          }
        }
      });
      return;
    }

    res.status(202).json({ success: true, runId, mode: 'queued' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/atp/runs/:runId', async (req, res) => {
  try {
    const run = await TestRun.findOne({ runId: req.params.runId });
    if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

    const { status, stats, results, finishedAt } = req.body;
    if (status) run.status = status;
    if (stats) run.stats = stats;
    if (results) run.results = results;
    if (finishedAt) run.finishedAt = finishedAt;
    if (status === 'running' && !run.startedAt) run.startedAt = new Date();

    await run.save();
    broadcastRun(run.runId, { type: 'run-update', run: run.toObject() });
    res.json({ success: true, run: run.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/atp/go-no-go', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'MongoDB required for go/no-go' });
    }
    const evaluation = await evaluateGoNoGo(TestRun);
    res.json({ success: true, ...evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/atp/schedules', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, schedules: [] });
    }
    const schedules = await Schedule.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/atp/schedules', async (req, res) => {
  try {
    const { name, suiteKey, envKey = 'local', cronExpression, enabled = true, slackWebhookUrl } = req.body;
    if (!name || !suiteKey || !cronExpression) {
      return res.status(400).json({ success: false, message: 'name, suiteKey, cronExpression required' });
    }
    const scheduleId = uuidv4();
    const doc = await Schedule.create({
      scheduleId,
      name,
      suiteKey,
      envKey,
      cronExpression,
      enabled,
      slackWebhookUrl: slackWebhookUrl || process.env.ATP_SLACK_WEBHOOK_URL || '',
      createdBy: req.body.triggeredBy || 'dashboard',
    });
    if (doc.enabled) await registerSchedule(doc);
    res.status(201).json({ success: true, schedule: doc.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/atp/schedules/:scheduleId', async (req, res) => {
  try {
    const doc = await Schedule.findOne({ scheduleId: req.params.scheduleId });
    if (!doc) return res.status(404).json({ success: false, message: 'Schedule not found' });
    const fields = ['name', 'suiteKey', 'envKey', 'cronExpression', 'enabled', 'slackWebhookUrl'];
    for (const f of fields) {
      if (req.body[f] !== undefined) doc[f] = req.body[f];
    }
    await doc.save();
    if (doc.enabled) await registerSchedule(doc);
    else await unregisterSchedule(doc.scheduleId);
    res.json({ success: true, schedule: doc.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/atp/schedules/:scheduleId', async (req, res) => {
  try {
    await unregisterSchedule(req.params.scheduleId);
    await Schedule.deleteOne({ scheduleId: req.params.scheduleId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/atp/stats/overview', async (_req, res) => {
  try {
    const catalog = fs.existsSync(CATALOG_PATH) ? JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) : { stats: {} };
    const lastRuns = await TestRun.find().sort({ createdAt: -1 }).limit(10).lean();
    const passed = lastRuns.filter((r) => r.status === 'passed').length;
    const passRate = lastRuns.length ? Math.round((passed / lastRuns.length) * 100) : null;

    res.json({
      success: true,
      catalog: catalog.stats,
      recentRuns: lastRuns.length,
      passRate7d: passRate,
      lastRuns,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

async function start() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log(`[ATP] MongoDB connected: ${config.mongoUri}`);
  } catch (err) {
    console.warn(`[ATP] MongoDB unavailable (${err.message}) — runs will not persist`);
  }

  app.listen(config.port, () => {
    console.log(`[ATP] Control plane http://localhost:${config.port}`);
    console.log(`[ATP] Health: http://localhost:${config.port}/atp/health`);
  });

  const { startQueueWorker } = await import('./queue.mjs');
  await startQueueWorker();

  const { startScheduler } = await import('./scheduler.mjs');
  await startScheduler();
}

start();
