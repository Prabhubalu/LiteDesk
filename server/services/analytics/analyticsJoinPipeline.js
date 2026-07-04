const mongoose = require('mongoose');
const { getCrossModuleJoin } = require('./analyticsRelationshipRegistry');
const { getAnalyticsModuleConfig } = require('./analyticsModuleRegistry');
const {
  resolveAnalyticsJoin,
  sortJoinModulesWithRelationships,
} = require('./analyticsRelationshipService');
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

  const columnGroups = Array.isArray(report.columnGroups) ? report.columnGroups : [];
  columnGroups.forEach(add);

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

function resolveJoinCollectionName(join) {
  if (join?.targetModel?.collection?.name) {
    return join.targetModel.collection.name;
  }
  return join?.targetCollection || '';
}

function buildJoinedFieldValueExpr(joinAs, targetModule, fieldKey) {
  const joinPath = `$${joinAs}`;
  const normalizedModule = String(targetModule || '').toLowerCase();
  const normalizedField = String(fieldKey || '').toLowerCase();

  if (normalizedModule === 'people' && normalizedField === 'name') {
    return {
      $trim: {
        input: {
          $concat: [
            { $ifNull: [`${joinPath}.first_name`, ''] },
            ' ',
            { $ifNull: [`${joinPath}.last_name`, ''] },
          ],
        },
      },
    };
  }

  return `${joinPath}.${fieldKey}`;
}

function resolveForeignIdExpr(join, primaryModule) {
  const sourceModule = String(primaryModule || '').toLowerCase();
  const baseExpr = join.joinFromAlias
    ? `$${join.joinFromAlias}.${join.localField}`
    : `$${join.localField}`;

  if (sourceModule === 'deals' && join.targetModule === 'people' && join.localField === 'contactId') {
    return {
      $ifNull: [
        baseExpr,
        {
          $let: {
            vars: {
              primaryContact: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: { $ifNull: ['$dealPeople', []] },
                      as: 'entry',
                      cond: {
                        $and: [
                          { $eq: ['$$entry.isPrimary', true] },
                          { $eq: ['$$entry.isActive', true] },
                          { $eq: ['$$entry.role', 'primary_contact'] },
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            },
            in: '$$primaryContact.personId',
          },
        },
      ],
    };
  }

  if (
    sourceModule === 'deals' &&
    join.targetModule === 'organizations' &&
    join.localField === 'accountId'
  ) {
    const primaryCustomerOrg = {
      $let: {
        vars: {
          primaryOrganization: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$dealOrganizations', []] },
                  as: 'entry',
                  cond: {
                    $and: [
                      { $eq: ['$$entry.isPrimary', true] },
                      { $eq: ['$$entry.isActive', true] },
                      { $eq: ['$$entry.role', 'customer'] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
        in: '$$primaryOrganization.organizationId',
      },
    };

    const firstActiveOrg = {
      $let: {
        vars: {
          activeOrganization: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$dealOrganizations', []] },
                  as: 'entry',
                  cond: { $eq: ['$$entry.isActive', true] },
                },
              },
              0,
            ],
          },
        },
        in: '$$activeOrganization.organizationId',
      },
    };

    return {
      $ifNull: [
        baseExpr,
        primaryCustomerOrg,
        firstActiveOrg,
        '$_analytics_join_people.organization',
      ],
    };
  }

  return baseExpr;
}

function coerceObjectIdMatchExpr(foreignVarName) {
  return {
    $eq: [
      '$_id',
      {
        $convert: {
          input: foreignVarName,
          to: 'objectId',
          onError: null,
          onNull: null,
        },
      },
    ],
  };
}

function partitionMatrixDrillFilters(matrixDrill, primaryModule) {
  const primary = String(primaryModule || '').toLowerCase();
  const primaryRowFilters = {};
  const joinedRowFilters = {};
  const primaryColumnFilters = {};
  const joinedColumnFilters = {};

  const assign = (filters, primaryOut, joinedOut) => {
    for (const [fieldKey, value] of Object.entries(filters || {})) {
      const parsed = parseQualifiedField(fieldKey);
      if (parsed.module && parsed.module !== primary) {
        joinedOut[fieldKey] = value;
      } else {
        primaryOut[parsed.field || fieldKey] = value;
      }
    }
  };

  assign(matrixDrill?.rowFilters, primaryRowFilters, joinedRowFilters);
  assign(matrixDrill?.columnFilters, primaryColumnFilters, joinedColumnFilters);

  return {
    primaryRowFilters,
    joinedRowFilters,
    primaryColumnFilters,
    joinedColumnFilters,
  };
}

function buildPostJoinDrillMatchStage(filters, primaryModule) {
  const clauses = [];

  for (const [fieldKey, value] of Object.entries(filters || {})) {
    const physical = resolvePhysicalField(primaryModule, fieldKey);
    if (value === null || value === undefined || value === '') {
      clauses.push({
        $or: [
          { [physical]: null },
          { [physical]: '' },
          { [physical]: { $exists: false } },
        ],
      });
      continue;
    }
    clauses.push({ [physical]: value });
  }

  if (!clauses.length) return null;
  if (clauses.length === 1) return { $match: clauses[0] };
  return { $match: { $and: clauses } };
}

function buildJoinLookupScopeMatch(targetModule, organizationId) {
  if (String(targetModule || '').toLowerCase() === 'organizations') {
    return { isTenant: { $ne: true } };
  }
  return { organizationId };
}

function prioritizeJoinModules(primaryModule, joinModules) {
  const primary = String(primaryModule || '').toLowerCase();
  if (primary !== 'deals') return joinModules;

  const priority = { people: 0, organizations: 1 };
  return [...joinModules].sort((a, b) => (priority[a] ?? 5) - (priority[b] ?? 5));
}

function resolvePhysicalField(primaryModule, field) {
  const parsed = parseQualifiedField(field);
  if (!parsed.module || parsed.module === String(primaryModule).toLowerCase()) {
    return parsed.field;
  }
  return joinFieldAlias(parsed.module, parsed.field);
}

async function buildJoinStages(report, context) {
  const primaryModule = String(report.primaryModule || '').toLowerCase();
  const requestedModules = resolveJoinModules(report);
  const joinModules = prioritizeJoinModules(
    primaryModule,
    await sortJoinModulesWithRelationships(
      primaryModule,
      requestedModules,
      context.organizationId,
    ),
  );
  if (!joinModules.length) {
    return { stages: [], aliasToQualified: {} };
  }

  const stages = [];
  const aliasToQualified = {};
  const organizationId = new mongoose.Types.ObjectId(String(context.organizationId));
  const joinedAliases = new Set();
  const primaryConfig = getAnalyticsModuleConfig(primaryModule);
  const joinPermissionAppKey = context.appKey || primaryConfig?.appKey;

  for (const targetModule of joinModules) {
    let join =
      getCrossModuleJoin(primaryModule, targetModule) ||
      (await resolveAnalyticsJoin(primaryModule, targetModule, context.organizationId));
    if (!join) continue;

    if (join.requiresJoin && !joinedAliases.has(join.requiresJoin)) {
      continue;
    }

    const access = resolveModuleDataAccess(context.user, join.targetModule, {
      appKey: joinPermissionAppKey,
      orgContext: context.orgContext,
    });
    if (!access.allowed) continue;

    const collectionName = resolveJoinCollectionName(join);
    if (!collectionName) continue;

    if (join.reverseJoin) {
      const lookupPipeline = [
        {
          $match: {
            $expr: { $eq: [`$${join.reverseLocalField}`, '$$primaryId'] },
            ...buildJoinLookupScopeMatch(join.targetModule, organizationId),
            ...(join.targetMatch || {}),
          },
        },
        { $limit: 1 },
      ];

      stages.push({
        $lookup: {
          from: collectionName,
          let: { primaryId: '$_id' },
          pipeline: lookupPipeline,
          as: join.joinAs,
        },
      });
    } else {
      const lookupPipeline = [
        {
          $match: {
            $expr: coerceObjectIdMatchExpr('$$foreignId'),
            ...buildJoinLookupScopeMatch(join.targetModule, organizationId),
            ...(join.targetMatch || {}),
          },
        },
      ];

      const foreignIdExpr = resolveForeignIdExpr(join, primaryModule);
      stages.push({
        $lookup: {
          from: collectionName,
          let: { foreignId: foreignIdExpr },
          pipeline: lookupPipeline,
          as: join.joinAs,
        },
      });
    }

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
          [alias]: buildJoinedFieldValueExpr(join.joinAs, targetModule, parsed.field),
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
  resolveForeignIdExpr,
  buildJoinLookupScopeMatch,
  buildJoinStages,
  joinFieldAlias,
  remapRows,
  remapColumns,
  partitionMatrixDrillFilters,
  buildPostJoinDrillMatchStage,
};
