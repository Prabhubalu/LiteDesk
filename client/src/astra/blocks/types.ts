export type AstraMetricItem = {
  id: string;
  label: string;
  value: number | string;
  tone?: 'primary' | 'neutral' | 'success' | 'warning';
};

export type AstraChartPoint = {
  name: string;
  value: number;
};

export type AstraRecordAction = {
  id?: string;
  label: string;
  prompt: string;
};

export type AstraRecordListItem = {
  id: string;
  title: string;
  subtitle?: string;
  status?: string | null;
  amount?: number | null;
  href?: string | null;
  actions?: AstraRecordAction[];
};

export type AstraUiBlock =
  | { type: 'metrics'; items: AstraMetricItem[] }
  | { type: 'chart'; title?: string; chartType?: 'bar' | 'donut' | 'pie' | 'line'; series: AstraChartPoint[] }
  | {
      type: 'record_list';
      entity?: string;
      title?: string;
      total?: number;
      items: AstraRecordListItem[];
    }
  | { type: 'empty'; title?: string; description?: string };
