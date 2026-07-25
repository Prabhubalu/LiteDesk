'use strict';

/**
 * Brief registry — one grounded packet per hydrate policy.brief kind.
 */

const { buildCanvasSituationBrief } = require('./canvasSituationBrief');
const { buildOrgExecutiveBrief, panelMetricsFromOrgBrief } = require('./orgExecutiveBrief');
const { getHydratePolicy } = require('./hydratePolicy');

function emptyPacket(focus = []) {
  return {
    situation: null,
    llmText: '',
    focus: Array.isArray(focus) ? focus : [],
    timelineItems: [],
    commsItems: [],
    openTasks: [],
    kpiMetrics: [],
    orgPanelMetrics: {},
    orgScoped: false,
    signalBullets: '',
    riskBullets: '',
    stakeholderBullets: '',
    competitorBullets: '',
  };
}

function abstractBrief({ prompt = '', intent = null, canvasType = '' } = {}) {
  const goals = (intent?.goals || []).join(', ') || 'summary';
  const lines = [
    `FOCUS: [workspace] ${canvasType || 'abstract'} — prompt-grounded board (no CRM party required)`,
    `USER ASK: ${String(prompt || '').slice(0, 500)}`,
    `GOALS: ${goals}`,
    'INSTRUCTION: Produce practical panel content for this workspace. '
    + 'Do not invent CRM records, deals, or dollar amounts. '
    + 'If CRM data is absent, stay qualitative and actionable.',
  ];
  return {
    ...emptyPacket([]),
    llmText: lines.join('\n'),
    situation: {
      ok: true,
      abstractScoped: true,
      focus: { title: canvasType || 'Workspace', moduleKey: 'workspace' },
      related: [],
      activities: [],
      communications: [],
    },
  };
}

/**
 * Build the situation/brief packet for hydrate.
 * @param {{
 *   organizationId: string,
 *   focus?: Array,
 *   prompt?: string,
 *   canvasType?: string,
 *   intent?: object|null,
 *   policy?: object|null,
 * }} input
 */
async function buildBriefForCanvas(input = {}) {
  const {
    organizationId,
    focus = [],
    prompt = '',
    canvasType = '',
    intent = null,
  } = input;
  const policy = input.policy || getHydratePolicy(canvasType, intent);
  const briefKind = policy.brief || 'none';

  if (!organizationId || briefKind === 'none') {
    return emptyPacket(focus);
  }

  if (briefKind === 'abstract') {
    return abstractBrief({ prompt, intent, canvasType });
  }

  if (briefKind === 'org') {
    try {
      const orgBrief = await buildOrgExecutiveBrief({ organizationId });
      return {
        ...emptyPacket(focus),
        situation: orgBrief.situation,
        llmText: orgBrief.llmText || '',
        openTasks: orgBrief.openTasks || [],
        kpiMetrics: orgBrief.kpiMetrics || [],
        orgPanelMetrics: orgBrief.orgPanelMetrics || {},
        orgScoped: true,
        signalBullets: orgBrief.signalBullets || '',
        riskBullets: orgBrief.riskBullets || '',
      };
    } catch (err) {
      console.warn('[canvasBriefRegistry] org brief failed:', err?.message || err);
      return emptyPacket(focus);
    }
  }

  // party | account | case | project → CRM situation when focus exists
  const hasFocus = (Array.isArray(focus) ? focus : []).some((f) => f?.moduleKey && f?.recordId);
  if (!hasFocus) {
    // QBR / project may fall back to org when policy allows
    if (policy.fillWithoutParty && (briefKind === 'account' || briefKind === 'project')) {
      try {
        const orgBrief = await buildOrgExecutiveBrief({ organizationId });
        const label = briefKind === 'account' ? 'account/QBR' : 'project';
        return {
          ...emptyPacket(focus),
          situation: orgBrief.situation,
          llmText:
            `${orgBrief.llmText || ''}\nNOTE: No ${label} focus resolved — using org-wide CRM snapshot.\n`.slice(0, 4500),
          openTasks: orgBrief.openTasks || [],
          kpiMetrics: orgBrief.kpiMetrics || [],
          orgPanelMetrics: orgBrief.orgPanelMetrics || {},
          orgScoped: true,
          signalBullets: orgBrief.signalBullets || '',
          riskBullets: orgBrief.riskBullets || '',
        };
      } catch (err) {
        console.warn('[canvasBriefRegistry] fallback org brief failed:', err?.message || err);
      }
    }
    if (policy.fillWithoutParty) {
      return abstractBrief({ prompt, intent, canvasType });
    }
    return emptyPacket(focus);
  }

  // Prefer preferred modules for account/case/project
  let orderedFocus = [...(Array.isArray(focus) ? focus : [])];
  const preferred = policy.preferredFocusModules || [];
  if (preferred.length) {
    orderedFocus.sort((a, b) => {
      const ai = preferred.indexOf(String(a.moduleKey || '').toLowerCase());
      const bi = preferred.indexOf(String(b.moduleKey || '').toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  const partyBrief = await buildCanvasSituationBrief({
    organizationId,
    focus: orderedFocus,
    prompt,
    canvasType,
    // Skip nested org executive path — registry already chose party/account
    skipOrgExecutive: true,
  });

  return {
    ...emptyPacket(orderedFocus),
    ...partyBrief,
    orgScoped: false,
  };
}

module.exports = {
  buildBriefForCanvas,
  abstractBrief,
  emptyPacket,
  panelMetricsFromOrgBrief,
};
