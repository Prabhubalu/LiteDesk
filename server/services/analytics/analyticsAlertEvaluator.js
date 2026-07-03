const mongoose = require('mongoose');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const AnalyticsAlert = require('../../models/AnalyticsAlert');
const { ANALYTICS_ALERT_COOLDOWN_MS } = require('../../constants/analyticsAlert');
const { sendSystemEmail } = require('../emailService');
const {
  extractMetricFromResult,
  evaluateThresholdOperator,
  formatOperatorLabel,
} = require('./analyticsMetricUtils');

async function deliverAlertNotifications(alert, widget, metricValue, organizationId) {
  const recipientIds = (alert.recipientUserIds || []).map((id) => String(id));
  if (!recipientIds.length) return;

  const users = await User.find({
    _id: { $in: recipientIds },
    organizationId,
  })
    .select('_id email firstName lastName')
    .lean();

  const widgetName = widget?.name || 'Widget';
  const opLabel = formatOperatorLabel(alert.operator);
  const title = `Analytics alert: ${alert.name}`;
  const body = `${widgetName} metric is ${metricValue} (threshold ${opLabel} ${alert.threshold}).`;

  for (const user of users) {
    if (alert.notifyInApp) {
      try {
        await Notification.create({
          userId: user._id,
          organizationId: new mongoose.Types.ObjectId(organizationId),
          appKey: 'PLATFORM',
          eventType: 'ANALYTICS_ALERT_TRIGGERED',
          title,
          body,
          channel: 'IN_APP',
          source: 'SYSTEM',
          entity: {
            type: 'analytics_alert',
            id: alert._id,
          },
        });
      } catch (err) {
        console.warn('[analyticsAlertEvaluator] Notification.create failed:', err?.message || err);
      }
    }

    if (alert.notifyEmail && user.email) {
      try {
        await sendSystemEmail({
          to: user.email,
          subject: title,
          text: body,
          html: `<p>${body}</p>`,
        });
      } catch (err) {
        console.warn('[analyticsAlertEvaluator] sendSystemEmail failed:', err?.message || err);
      }
    }
  }
}

async function evaluateAlertsForWidgetExecution({ organizationId, widget, result }) {
  if (!organizationId || !widget?._id || !result) return;

  const alerts = await AnalyticsAlert.find({
    organizationId,
    widgetId: widget._id,
    status: 'active',
  }).lean();

  if (!alerts.length) return;

  for (const alert of alerts) {
    const metricValue = extractMetricFromResult(
      result,
      alert.metricField,
      widget.columnMapping,
      widget.kpiValueField
    );

    if (!evaluateThresholdOperator(metricValue, alert.operator, alert.threshold)) continue;

    if (
      alert.lastTriggeredAt &&
      Date.now() - new Date(alert.lastTriggeredAt).getTime() < ANALYTICS_ALERT_COOLDOWN_MS
    ) {
      continue;
    }

    await deliverAlertNotifications(alert, widget, metricValue, organizationId);
    await AnalyticsAlert.updateOne(
      { _id: alert._id },
      { $set: { lastTriggeredAt: new Date(), lastTriggeredValue: metricValue } }
    );
  }
}

module.exports = {
  evaluateAlertsForWidgetExecution,
};
