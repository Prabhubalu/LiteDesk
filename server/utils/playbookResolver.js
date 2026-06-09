'use strict';

const ModuleDefinition = require('../models/ModuleDefinition');

async function loadDealsPipelineSettings(organizationId) {
  if (!organizationId) return [];

  let moduleDef = await ModuleDefinition.findOne({
    organizationId,
    key: 'deals'
  }).select('pipelineSettings').lean();

  if (!moduleDef) {
    moduleDef = await ModuleDefinition.findOne({
      organizationId: null,
      type: 'system',
      key: 'deals'
    }).select('pipelineSettings').lean();
  }

  return Array.isArray(moduleDef?.pipelineSettings) ? moduleDef.pipelineSettings : [];
}

function resolvePipelineStage(pipelineSettings, pipelineKey, stageName) {
  if (!Array.isArray(pipelineSettings) || !pipelineSettings.length) {
    return null;
  }

  const normalizedPipelineKey = String(pipelineKey || '').trim();
  const normalizedStageName = String(stageName || '').trim();

  const pipeline = (normalizedPipelineKey
    ? pipelineSettings.find((item) => item.key === normalizedPipelineKey)
    : null)
    || pipelineSettings.find((item) => item.isDefault)
    || pipelineSettings[0];

  if (!pipeline || !Array.isArray(pipeline.stages)) {
    return null;
  }

  const stage = pipeline.stages.find((item) => {
    const name = String(item.name || '').trim();
    const key = String(item.key || '').trim();
    return name === normalizedStageName || key === normalizedStageName;
  });

  if (!stage) {
    return null;
  }

  return { pipeline, stage };
}

function resolvePipelineByKey(pipelineSettings, pipelineKey) {
  if (!Array.isArray(pipelineSettings) || !pipelineSettings.length) {
    return null;
  }

  const normalizedPipelineKey = String(pipelineKey || '').trim();
  return (normalizedPipelineKey
    ? pipelineSettings.find((item) => item.key === normalizedPipelineKey)
    : null)
    || pipelineSettings.find((item) => item.isDefault)
    || pipelineSettings[0];
}

function resolveStageByKey(pipelineSettings, pipelineKey, stageKey) {
  const pipeline = resolvePipelineByKey(pipelineSettings, pipelineKey);
  const normalizedStageKey = String(stageKey || '').trim();
  if (!pipeline || !Array.isArray(pipeline.stages) || !normalizedStageKey) {
    return null;
  }

  const stage = pipeline.stages.find((item) => String(item.key || '').trim() === normalizedStageKey);
  if (!stage) {
    return null;
  }

  return { pipeline, stage };
}

function resolveStagePlaybook(pipelineSettings, pipelineKey, stageName) {
  const resolved = resolvePipelineStage(pipelineSettings, pipelineKey, stageName);
  if (!resolved) return null;

  const playbook = resolved.stage.playbook;
  if (!playbook || playbook.enabled !== true) {
    return null;
  }

  return {
    pipelineKey: resolved.pipeline.key,
    pipelineName: resolved.pipeline.name,
    stageKey: resolved.stage.key,
    stageName: resolved.stage.name,
    playbook
  };
}

module.exports = {
  loadDealsPipelineSettings,
  resolvePipelineByKey,
  resolvePipelineStage,
  resolveStageByKey,
  resolveStagePlaybook
};
