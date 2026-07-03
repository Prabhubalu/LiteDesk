const mongoose = require('mongoose');
const { getCrossModuleJoin, sortJoinModules } = require('./analyticsRelationshipRegistry');
const { resolveModuleDataAccess } = require('./analyticsAccessGuard');

function parseQualifiedField(field) {
  const raw = String(field || '').trim();
  if (!raw.includes('.')) {
    return { module: null, field: raw, qualified: raw };
  }
  const dot = raw.indexOf('.');
  const module = raw.slice(0, dot).toLowerCase();
  const rest = raw.slice(dot + 1);
  return { module, field: rest, qualified: raw };
}

function collectQualifiedFields(report) {
  const out = new Set();
  const add = (entry) => {
    const field = typeof entry === 'string' ? entry : entry?.field;
    if (field) out.add(String(field));
  };

  const selected = Array.isArray(report.selectedFields) ? report.selectedFields : [];
  selected.forEach(add);

  const rowGroups = Array.isArray(report.rowGroups) ? report.rowGroups : [];
  rowGroups.forEach(add);

  const aggregations = Array.isArray(report.aggregations) ? report.aggregations : [];
  aggregations.forEach(add);

  const sorting = Array.isArray(report.sorting) ? report.sorting : [];
  sorting.forEach(add);

  for (const mod of report.relatedModules || []) {
    out.add(`${mod}._id`);
  }

  return [...out];
}

function resolveJoinModules(report) {
  const primary = String(report.primaryModule || '').toLowerCase();
  const modules = new Set();

  for (const field of collectQualifiedFields(report)) {
    const parsed = parseQualifiedField(field);
    if (parsed.module && parsed.module !== primary) {
      modules.add(parsed.module);
    }
  }

  for (const mod of report.relatedModules || []) {
    const normalized = String(mod || '').toLowerCase();
    if (normalized && normalized !== primary) {
      modules.add(normalized);
    }
  }

  return [...modules];
}

function joinFieldAlias(targetModule, field) {
  return `${targetModule}__${String(field).replace(/\./g, '_')}`;
}

function resolvePhysicalField(primaryModule, field) {
  const parsed = parseQualifiedField(field);
  if (!parsed.module || parsed.module === String(primaryModule).toLowerCase()) {
    return parsed.field;
  }
  return joinFieldAlias(parsed.module, parsed.field);
}

function buildJoinStages(report, context) {
  const primaryModule = String(report.primaryModule || '').toLowerCase();
  const joinModules = sortJoinModules(primaryModule, resolveJoinModules(report));
  if (!joinModules.length) {
    return { stages: [], aliasToQualified: {} };
  }

  const stages = [];
  const aliasToQualified = {};
  const organizationId = new mongoose.Types.ObjectId(String(context.organizationId));
  const joinedAliases = new Set();

  for (const targetModule of joinModules) {
    const join = getCrossModuleJoin(primaryModule, targetModule);
    if (!join) continue;

    if (join.requiresJoin && !joinedAliases.has(join.requiresJoin)) {
      continue;
    }

    const access = resolveModuleDataAccess(context.user, join.targetModule, {
      appKey: context.appKey,
      orgContext: context.orgContext,
    });
    if (!access.allowed) continue;

    const lookupPipeline = [
      {
        $match: {
          $expr: { $eq: ['$_id', '$$foreignId'] },
          organizationId,
          ...(join.targetMatch || {}),
        },
      },
    ];

    if (access.ownershipMatch) {
      lookupPipeline[0].$match = { ...lookupPipeline[0].$match, ...access.ownershipMatch };
    }

    const foreignIdExpr = join.joinFromAlias
      ? `$${join.joinFromAlias}.${join.localField}`
      : `$${join.localField}`;

    stages.push({
      $lookup: {
        from: join.targetCollection,
        let: { foreignId: foreignIdExpr },
        pipeline: lookupPipeline,
        as: join.joinAs,
      },
    });
    stages.push({
      $unwind: { path: `$${join.joinAs}`, preserveNullAndEmptyArrays: true },
    });

    joinedAliases.add(targetModule);

    for (const field of collectQualifiedFields(report)) {
      const parsed = parseQualifiedField(field);
      if (parsed.module !== targetModule) continue;
      const alias = joinFieldAlias(targetModule, parsed.field);
      aliasToQualified[alias] = parsed.qualified;
      stages.push({
        $addFields: {
          [alias]: `$${join.joinAs}.${parsed.field}`,
        },
      });
    }
  }

  return { stages, aliasToQualified };
}

function remapRowKeys(row, aliasToQualified) {
  if (!aliasToQualified || !Object.keys(aliasToQualified).length) return row;
  const out = { ...row };
  for (const [alias, qualified] of Object.entries(aliasToQualified)) {
    if (Object.prototype.hasOwnProperty.call(out, alias)) {
      out[qualified] = out[alias];
      delete out[alias];
    }
  }
  return out;
}

function remapRows(rows, aliasToQualified) {
  if (!aliasToQualified || !Object.keys(aliasToQualified).length) return rows;
  return rows.map((row) => remapRowKeys(row, aliasToQualified));
}

function remapColumns(columns, primaryModule, aliasToQualified) {
  const inverted = aliasToQualified || {};
  return columns.map((col) => {
    if (col.includes('.')) return col;
    for (const [alias, qualified] of Object.entries(inverted)) {
      if (alias === col) return qualified;
    }
    return col;
  });
}

module.exports = {
  parseQualifiedField,
  collectQualifiedFields,
  resolveJoinModules,
  resolvePhysicalField,
  buildJoinStages,
  joinFieldAlias,
  remapRows,
  remapColumns,
};
