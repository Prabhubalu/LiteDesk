/**
 * Seed dashboard templates for A4 catalog (client designer quick-start).
 */
const ANALYTICS_DASHBOARD_TEMPLATES = Object.freeze([
  {
    templateKey: 'sales_pipeline',
    name: 'Sales Pipeline',
    description: 'Pipeline stages, open deals KPI, and deal trends',
    category: 'team',
    icon: 'chart-bar',
    suggestedWidgets: ['pipeline_by_stage', 'open_deals_kpi'],
  },
  {
    templateKey: 'helpdesk_sla',
    name: 'Helpdesk SLA',
    description: 'Cases by priority and support workload overview',
    category: 'app',
    appKey: 'HELPDESK',
    icon: 'lifebuoy',
    suggestedWidgets: ['cases_by_priority'],
  },
  {
    templateKey: 'executive_summary',
    name: 'Executive Summary',
    description: 'High-level KPIs and charts for leadership reviews',
    category: 'executive',
    icon: 'presentation-chart-line',
    suggestedWidgets: ['open_deals_kpi', 'pipeline_by_stage', 'cases_by_priority'],
  },
]);

module.exports = { ANALYTICS_DASHBOARD_TEMPLATES };
