const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  recordIngest,
  renderPrometheus,
  getSnapshot
} = require('../../platform/mailroom/observability/mailroomMetrics');

describe('mailroom metrics', () => {
  it('records ingest counters and prometheus output', () => {
    recordIngest({
      channel: 'email',
      connectorType: 'raw_mime_webhook',
      success: true,
      durationMs: 120,
      duplicate: true
    });

    const snap = getSnapshot();
    assert.ok(snap.ingestTotal >= 1);
    assert.ok(snap.duplicateTotal >= 1);

    const text = renderPrometheus();
    assert.match(text, /mailroom_ingest_total/);
    assert.match(text, /mailroom_processing_duration_ms/);
  });
});
