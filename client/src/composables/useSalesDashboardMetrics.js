import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { buildDashboardFromRegistry } from '@/utils/buildDashboardFromRegistry';
import { getAppRegistry } from '@/utils/getAppRegistry';
import apiClient from '@/utils/apiClient';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import { getNavigationIconComponent } from '@/utils/navigationIcons';

/** @typedef {import('@/types/salesDashboardMetrics.types').SalesDashboardMetricsResponse} SalesDashboardMetricsResponse */

const EMPTY_METRICS = {
  generatedAt: null,
  pipelines: [],
  kpis: {
    openDeals: 0,
    totalDeals: 0,
    pipelineValue: 0,
    weightedPipelineValue: 0,
    closingSoon: 0
  },
  executiveSnapshot: {},
  pipelineHealth: {
    stages: [],
    biggestDropoff: { from: null, to: null, dropPct: 0 },
    stuckDeals: []
  },
  forecasting: {
    commit: 0,
    bestCase: 0,
    pipelineUncommitted: 0,
    byRep: [],
    byClosingMonth: [],
    accuracyLast3Months: [],
    vsTarget: { target: 0, forecastTotal: 0, attainmentPct: 0 }
  },
  repPerformance: [],
  activityPipeline: {
    activityOverTime: [],
    newPipelinePerWeek: [],
    activityToDealConversionPct: 0,
    efficiencyFlags: []
  },
  trend: { values: [] },
  alerts: [],
  aiSummary: {
    hitTargetLikelihoodPct: 0,
    summary: '',
    recommendedActions: []
  },
  moduleCounts: {},
  windows: {},
  health: {}
};

const asArray = (value) => (Array.isArray(value) ? value : []);
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

/**
 * Normalize API payload so widgets consume one stable shape.
 * @param {unknown} raw
 * @returns {SalesDashboardMetricsResponse}
 */
const normalizeDashboardMetrics = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const alerts = asArray(source.alerts).map((item, idx) => {
    const severity = String(item?.severity || item?.priority || 'low').toLowerCase();
    return {
      code: String(item?.code || `ALERT_${idx + 1}`),
      message: String(item?.message || ''),
      action: String(item?.action || ''),
      severity,
      priority: String(item?.priority || severity)
    };
  });

  const rawAiSummary = source.aiSummary && typeof source.aiSummary === 'object'
    ? source.aiSummary
    : {};

  return {
    ...EMPTY_METRICS,
    ...source,
    pipelines: asArray(source.pipelines).filter(Boolean),
    kpis: {
      ...EMPTY_METRICS.kpis,
      ...source.kpis
    },
    executiveSnapshot: {
      ...source.executiveSnapshot
    },
    pipelineHealth: {
      ...EMPTY_METRICS.pipelineHealth,
      ...source.pipelineHealth,
      stages: asArray(source?.pipelineHealth?.stages),
      stuckDeals: asArray(source?.pipelineHealth?.stuckDeals),
      biggestDropoff: {
        ...EMPTY_METRICS.pipelineHealth.biggestDropoff,
        ...source?.pipelineHealth?.biggestDropoff
      }
    },
    forecasting: {
      ...EMPTY_METRICS.forecasting,
      ...source.forecasting,
      byRep: asArray(source?.forecasting?.byRep),
      byClosingMonth: asArray(source?.forecasting?.byClosingMonth),
      accuracyLast3Months: asArray(source?.forecasting?.accuracyLast3Months),
      vsTarget: {
        ...EMPTY_METRICS.forecasting.vsTarget,
        ...source?.forecasting?.vsTarget
      }
    },
    repPerformance: asArray(source.repPerformance),
    activityPipeline: {
      ...EMPTY_METRICS.activityPipeline,
      ...source.activityPipeline,
      activityOverTime: asArray(source?.activityPipeline?.activityOverTime),
      newPipelinePerWeek: asArray(source?.activityPipeline?.newPipelinePerWeek),
      efficiencyFlags: asArray(source?.activityPipeline?.efficiencyFlags),
      activityToDealConversionPct: asNumber(source?.activityPipeline?.activityToDealConversionPct)
    },
    trend: {
      values: asArray(source?.trend?.values),
      rawValues: asArray(source?.trend?.rawValues)
    },
    alerts,
    aiSummary: {
      hitTargetLikelihoodPct: asNumber(rawAiSummary.hitTargetLikelihoodPct),
      summary: String(rawAiSummary.summary || ''),
      recommendedActions: asArray(rawAiSummary.recommendedActions).map((action) => String(action || ''))
    },
    moduleCounts: source.moduleCounts && typeof source.moduleCounts === 'object' ? source.moduleCounts : {},
    windows: source.windows && typeof source.windows === 'object' ? source.windows : {},
    health: source.health && typeof source.health === 'object' ? source.health : {}
  };
};

export function useSalesDashboardMetrics({ appKey, authStore }) {
  const loading = ref(true);
  const dashboardDefinition = ref(null);
  const dashboardMetrics = ref(null);
  const now = ref(new Date());
  const selectedRangeIndex = ref(0);
  const selectedRepId = ref('all');
  const selectedPipeline = ref('all');
  const selectedDealType = ref('all');
  let nowTicker = null;
  const resolvedAppKey = computed(() => String(appKey?.value || 'SALES').toUpperCase());
  const isSalesApp = computed(() => resolvedAppKey.value === 'SALES');

  const timeRanges = [
    { label: 'Last 12 weeks', key: '12w' },
    { label: 'Last 6 months', key: '6m' },
    { label: 'Last 12 months', key: '12m' }
  ];
  const dealTypeOptions = ['New Business', 'Existing Customer', 'Upsell', 'Renewal', 'Cross-Sell'];

  const resolveKpiMetricValue = (kpi, metricsKpis) => {
    const key = String(kpi?.key || '').toLowerCase();
    const label = String(kpi?.label || '').toLowerCase();
    if (key.includes('open') || label.includes('open')) return metricsKpis.openDeals;
    if (key.includes('weighted') || label.includes('weighted')) return metricsKpis.weightedPipelineValue;
    if (key.includes('pipeline') || label.includes('pipeline') || label.includes('value')) return metricsKpis.pipelineValue;
    if (key.includes('close') || label.includes('close') || label.includes('soon')) return metricsKpis.closingSoon;
    if (key.includes('total') || label.includes('total')) return metricsKpis.totalDeals;
    return undefined;
  };

  const applyMetricsToDefinition = (definition, metrics) => {
    if (!definition || !metrics) return definition;
    const metricsKpis = metrics.kpis || {};
    const metricsCounts = metrics.moduleCounts || {};

    return {
      ...definition,
      kpis: (definition.kpis || []).map((kpi) => {
        const mappedValue = resolveKpiMetricValue(kpi, metricsKpis);
        return { ...kpi, value: mappedValue !== undefined ? mappedValue : kpi.value };
      }),
      modules: (definition.modules || []).map((module) => {
        const moduleKey = String(module.moduleKey || '').toLowerCase();
        const count = metricsCounts[moduleKey];
        return { ...module, count: typeof count === 'number' ? count : module.count };
      })
    };
  };

  const selectedRangeKey = computed(() => timeRanges[selectedRangeIndex.value]?.key || '12w');
  const selectedRangeLabel = computed(() => timeRanges[selectedRangeIndex.value]?.label || 'Last 12 weeks');
  const formattedNow = computed(() => now.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const fetchDashboardMetrics = async (definition) => {
    if (!isSalesApp.value) {
      dashboardMetrics.value = null;
      if (definition) {
        dashboardDefinition.value = definition;
      }
      return;
    }

    try {
      const params = { range: selectedRangeKey.value };
      if (selectedRepId.value !== 'all') params.repIds = selectedRepId.value;
      if (selectedPipeline.value !== 'all') params.pipeline = selectedPipeline.value;
      if (selectedDealType.value !== 'all') params.dealType = selectedDealType.value;
      const response = await apiClient('/deals/dashboard/metrics', { params });
      if (!response?.success || !response?.data) return;

      const normalizedMetrics = normalizeDashboardMetrics(response.data);
      dashboardMetrics.value = normalizedMetrics;
      if (dashboardDefinition.value) {
        dashboardDefinition.value = applyMetricsToDefinition(dashboardDefinition.value, normalizedMetrics);
      } else if (definition) {
        dashboardDefinition.value = applyMetricsToDefinition(definition, normalizedMetrics);
      }
    } catch (error) {
      console.error('[useSalesDashboardMetrics] Error fetching dashboard metrics:', error);
      if (definition && dashboardDefinition.value) {
        dashboardDefinition.value = applyMetricsToDefinition(dashboardDefinition.value, dashboardMetrics.value);
      }
    }
  };

  const buildDashboard = async () => {
    if (!authStore.user || !authStore.isAuthenticated) {
      dashboardDefinition.value = null;
      loading.value = false;
      return;
    }

    loading.value = true;
    try {
      const registry = await getAppRegistry();
      if (!authStore.user || !authStore.isAuthenticated) return;

      const snapshot = createPermissionSnapshot(authStore.user);
      const appKeyToUse = resolvedAppKey.value;
      const definition = buildDashboardFromRegistry(appKeyToUse, registry, snapshot);

      if (authStore.user && authStore.isAuthenticated) {
        dashboardDefinition.value = definition;
        await fetchDashboardMetrics(definition);
      }
    } catch (error) {
      console.error('[useSalesDashboardMetrics] Error building dashboard:', error);
      if (authStore.isAuthenticated) {
        dashboardDefinition.value = null;
      }
    } finally {
      if (authStore.isAuthenticated) {
        loading.value = false;
      }
    }
  };

  const formatCurrency = (value) => {
    const amount = Number(value || 0);
    if (Math.abs(amount) >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const formatMetricValue = (value, kind) => {
    if (kind === 'currency') return formatCurrency(value);
    if (kind === 'percent') return `${Number(value || 0).toFixed(1)}%`;
    if (kind === 'days') return `${Math.round(Number(value || 0))}d`;
    if (kind === 'ratio') return `${Number(value || 0).toFixed(2)}x`;
    return String(value ?? '');
  };

  const getQuickAccessIcon = (module) => getNavigationIconComponent(module);
  const cycleRange = () => {
    selectedRangeIndex.value = (selectedRangeIndex.value + 1) % timeRanges.length;
  };
  const resetFilters = async () => {
    selectedRepId.value = 'all';
    selectedPipeline.value = 'all';
    selectedDealType.value = 'all';
    if (authStore.user && authStore.isAuthenticated && dashboardDefinition.value) {
      await fetchDashboardMetrics(dashboardDefinition.value);
    }
  };

  const trendSubtitle = computed(() => {
    const generatedAt = dashboardMetrics.value?.generatedAt;
    const staleDays = dashboardMetrics.value?.windows?.staleDays;
    if (!generatedAt) return 'Waiting for fresh analytics data';
    const date = new Date(generatedAt);
    const updatedAt = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return staleDays
      ? `Live analytics updated ${updatedAt} • stale threshold ${staleDays}+ days`
      : `Live analytics updated ${updatedAt}`;
  });

  const totalKpiValue = computed(() => {
    if (!dashboardDefinition.value?.kpis?.length) return 0;
    return dashboardDefinition.value.kpis.reduce((sum, kpi) => sum + (typeof kpi.value === 'number' ? kpi.value : 0), 0);
  });

  const performanceSeries = computed(() => {
    const liveSeries = dashboardMetrics.value?.trend?.values;
    if (Array.isArray(liveSeries) && liveSeries.length > 0) return liveSeries;
    const base = totalKpiValue.value > 0 ? Math.min(70, Math.max(28, Math.round(totalKpiValue.value / 15))) : 32;
    return Array.from({ length: 12 }, (_, idx) => {
      const wave = Math.round(Math.sin((idx + selectedRangeIndex.value) / 2) * 8);
      const drift = idx > 7 ? 5 : 0;
      return Math.max(18, Math.min(92, base + wave + drift));
    });
  });

  const trendDirectionLabel = computed(() => {
    const healthStatus = dashboardMetrics.value?.health?.status;
    if (healthStatus === 'strong') return 'Strong pipeline health';
    if (healthStatus === 'watch') return 'Watchlist active';
    if (healthStatus === 'at_risk') return 'Risk needs attention';
    if (!performanceSeries.value.length) return 'Stable';
    const first = performanceSeries.value[0];
    const last = performanceSeries.value[performanceSeries.value.length - 1];
    if (last - first > 4) return 'Upward trend';
    if (first - last > 4) return 'Needs attention';
    return 'Stable trend';
  });

  const executiveKpiCards = computed(() => {
    const snapshot = dashboardMetrics.value?.executiveSnapshot || {};
    const globalTrend = Array.isArray(dashboardMetrics.value?.trend?.values)
      ? dashboardMetrics.value.trend.values.slice(-7)
      : [];
    const list = [
      { key: 'totalRevenue', label: 'Total Revenue', kind: 'currency' },
      { key: 'pipelineValue', label: 'Pipeline Value', kind: 'currency' },
      { key: 'forecast', label: 'Forecast', kind: 'currency' },
      { key: 'winRate', label: 'Win Rate', kind: 'percent' },
      { key: 'avgSalesCycle', label: 'Avg Sales Cycle', kind: 'days' },
      { key: 'pipelineCoverage', label: 'Pipeline Coverage', kind: 'ratio' }
    ];
    return list.map((item) => {
      const metric = snapshot[item.key] || {};
      return {
        key: item.key,
        label: item.label,
        delta: Number(metric.deltaPct || 0),
        trend: Array.isArray(metric.trend) ? metric.trend : globalTrend,
        formattedValue: formatMetricValue(metric.value || 0, item.kind)
      };
    });
  });

  const pipelineStages = computed(() => dashboardMetrics.value?.pipelineHealth?.stages || []);
  const biggestDropoffSummary = computed(() => {
    const drop = dashboardMetrics.value?.pipelineHealth?.biggestDropoff;
    if (!drop?.from || !drop?.to) return 'No major drop-off detected';
    return `${drop.from} → ${drop.to} (${drop.dropPct}% drop)`;
  });
  const stuckDealsSummary = computed(() => {
    const stuckDeals = dashboardMetrics.value?.pipelineHealth?.stuckDeals || [];
    if (!stuckDeals.length) return 'No stuck-stage risk detected';
    return stuckDeals.map((s) => `${s.count} in ${s.stageId}`).join(' • ');
  });
  const forecastPanel = computed(() => dashboardMetrics.value?.forecasting || {
    commit: 0,
    bestCase: 0,
    pipelineUncommitted: 0,
    vsTarget: { attainmentPct: 0 }
  });
  const forecastByRep = computed(() => dashboardMetrics.value?.forecasting?.byRep || []);
  const repPerformanceRows = computed(() => dashboardMetrics.value?.repPerformance || []);
  const activityOverTime = computed(() => dashboardMetrics.value?.activityPipeline?.activityOverTime || []);
  const newPipelinePerWeek = computed(() => dashboardMetrics.value?.activityPipeline?.newPipelinePerWeek || []);
  const activityToDealConversionPct = computed(() => dashboardMetrics.value?.activityPipeline?.activityToDealConversionPct || 0);
  const efficiencyFlags = computed(() => dashboardMetrics.value?.activityPipeline?.efficiencyFlags || []);
  const alertsData = computed(() => dashboardMetrics.value?.alerts || []);
  const aiInsightCards = computed(() => {
    const summary = dashboardMetrics.value?.aiSummary;
    const fallback = [
      { title: 'Forecast confidence', body: 'Commit forecast is tracking within expected range.' },
      { title: 'Stage focus', body: 'Proposal stage requires tighter follow-up to reduce leakage.' },
      { title: 'Top performer', body: 'Top rep is outperforming baseline with stronger win rate.' },
      { title: 'Suggested action', body: 'Increase qualified pipeline to improve target coverage.' }
    ];
    if (!summary || typeof summary !== 'object') return fallback;

    const cards = [];
    if (Number.isFinite(summary.hitTargetLikelihoodPct)) {
      cards.push({
        title: 'Target likelihood',
        body: `${Math.round(summary.hitTargetLikelihoodPct)}% likelihood to hit target in this window.`
      });
    }
    if (summary.summary) {
      cards.push({
        title: 'Forecast confidence',
        body: String(summary.summary)
      });
    }
    const actions = Array.isArray(summary.recommendedActions) ? summary.recommendedActions : [];
    actions.slice(0, 2).forEach((action, idx) => {
      cards.push({
        title: idx === 0 ? 'Immediate action' : 'Secondary action',
        body: String(action)
      });
    });

    return cards.slice(0, 4).length ? cards.slice(0, 4) : fallback;
  });
  const repFilterOptions = computed(() => forecastByRep.value.map((rep) => ({ repId: rep.repId, name: rep.name })));
  const pipelineFilterOptions = computed(() => {
    const pipelines = dashboardMetrics.value?.pipelines || [];
    return Array.from(new Set(pipelines.filter(Boolean)));
  });

  watch(() => authStore.user, () => {
    if (authStore.user && authStore.isAuthenticated) {
      buildDashboard();
    }
  }, { immediate: true });

  watch(() => appKey.value, () => {
    if (authStore.user && authStore.isAuthenticated) {
      buildDashboard();
    }
  });

  watch([selectedRangeIndex, selectedRepId, selectedPipeline, selectedDealType], async () => {
    if (!authStore.user || !authStore.isAuthenticated || !dashboardDefinition.value) return;
    await fetchDashboardMetrics(dashboardDefinition.value);
  });

  onMounted(() => {
    nowTicker = window.setInterval(() => {
      now.value = new Date();
    }, 60000);
    // Initial dashboard load is handled by watch(authStore.user, …, { immediate: true })
  });

  onBeforeUnmount(() => {
    if (nowTicker) {
      window.clearInterval(nowTicker);
    }
  });

  return {
    isSalesApp,
    loading,
    dashboardDefinition,
    selectedRepId,
    selectedPipeline,
    selectedDealType,
    dealTypeOptions,
    formattedNow,
    selectedRangeLabel,
    cycleRange,
    buildDashboard,
    resetFilters,
    executiveKpiCards,
    trendSubtitle,
    trendDirectionLabel,
    pipelineStages,
    biggestDropoffSummary,
    stuckDealsSummary,
    forecastPanel,
    forecastByRep,
    repPerformanceRows,
    activityOverTime,
    newPipelinePerWeek,
    activityToDealConversionPct,
    efficiencyFlags,
    alertsData,
    aiInsightCards,
    repFilterOptions,
    pipelineFilterOptions,
    getQuickAccessIcon,
    formatMetricValue
  };
}
