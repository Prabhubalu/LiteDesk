'use strict';

/**
 * Living Canvas automation — domain events → widget data refresh hints + smart suggestions.
 */

const AstraCanvas = require('../../models/AstraCanvas');
const AstraCanvasSuggestion = require('../../models/AstraCanvasSuggestion');
const { isAstraStudioEnabled } = require('./flags');
const { getRoom } = require('./yjsRoomManager');
const { listWidgets, docFromState } = require('./yjsDocument');

const ENTITY_TO_MODULE = {
  people: 'people',
  organization: 'organizations',
  deal: 'deals',
  quote: 'quotes',
  case: 'cases',
  task: 'tasks',
  event: 'events',
};

function moduleKeysForEvent(event) {
  const keys = new Set();
  if (event.entityType && ENTITY_TO_MODULE[event.entityType]) {
    keys.add(ENTITY_TO_MODULE[event.entityType]);
  }
  return keys;
}

function canvasTouchesEntity(canvas, event) {
  const moduleKeys = moduleKeysForEvent(event);
  const entityId = String(event.entityId || '');
  for (const f of canvas.focus || []) {
    if (moduleKeys.has(f.moduleKey) && String(f.recordId) === entityId) return true;
  }
  // Also scan yjs bindings when state present
  if (canvas.yjsState?.length) {
    try {
      const widgets = listWidgets(docFromState(canvas.yjsState));
      for (const w of widgets) {
        const b = w.bindings;
        if (!b) continue;
        if (moduleKeys.has(b.moduleKey) && (b.recordIds || []).map(String).includes(entityId)) {
          return true;
        }
      }
    } catch (_e) {
      // ignore
    }
  }
  return false;
}

function suggestionForEvent(event) {
  const t = event.eventType || '';
  if (t.includes('case') && (t.includes('created') || t.includes('escalat'))) {
    return {
      message: 'New support activity detected. Add or refresh a Risk section?',
      actionType: 'add_risk_widget',
      actionPayload: {
        ops: [
          {
            op: 'addWidget',
            widget: {
              id: `w_auto_${Date.now()}`,
              type: 'ai.risk',
              frame: { x: 40, y: 40, w: 320, h: 200, z: 5 },
              config: { title: 'Updated risks' },
              ai: { confidence: 0.6 },
            },
          },
        ],
      },
    };
  }
  if (t.includes('deal') && (t.includes('stage') || t.includes('won') || t.includes('updated'))) {
    return {
      message: 'Deal changed. Update forecast and status widgets?',
      actionType: 'refresh_forecast',
      actionPayload: { refreshTypes: ['analytics.forecast', 'crm.deal'] },
    };
  }
  if (t.includes('email') || t.includes('message') || t.includes('conversation')) {
    return {
      message: 'New customer communication. Refresh conversation timeline?',
      actionType: 'refresh_comms',
      actionPayload: { refreshTypes: ['comms.conversation_timeline'] },
    };
  }
  return null;
}

function broadcastWidgetData(organizationId, canvasId, payload) {
  const room = getRoom(String(organizationId), String(canvasId));
  if (!room) return;
  const msg = Buffer.concat([
    Buffer.from([2]), // type 2 = widget data channel
    Buffer.from(JSON.stringify(payload)),
  ]);
  for (const ws of room.sockets) {
    if (ws.readyState === 1) {
      try {
        ws.send(msg);
      } catch (_e) {
        // ignore
      }
    }
  }
}

async function handleDomainEvent(event) {
  if (!isAstraStudioEnabled()) return;
  if (!event?.organizationId || !event.entityId) return;

  const canvases = await AstraCanvas.find({
    organizationId: event.organizationId,
    deletedAt: null,
    status: { $in: ['draft', 'active'] },
  })
    .select('focus yjsState permissions organizationId')
    .limit(50)
    .lean();

  for (const canvas of canvases) {
    if (!canvasTouchesEntity(canvas, event)) continue;

    broadcastWidgetData(canvas.organizationId, canvas._id, {
      type: 'widget.refresh',
      entityType: event.entityType,
      entityId: event.entityId,
      eventType: event.eventType,
      at: event.timestamp || new Date().toISOString(),
    });

    const suggestion = suggestionForEvent(event);
    if (suggestion) {
      const recent = await AstraCanvasSuggestion.findOne({
        canvasId: canvas._id,
        status: 'pending',
        actionType: suggestion.actionType,
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
      })
        .select('_id')
        .lean();
      if (!recent) {
        await AstraCanvasSuggestion.create({
          organizationId: canvas.organizationId,
          canvasId: canvas._id,
          message: suggestion.message,
          actionType: suggestion.actionType,
          actionPayload: suggestion.actionPayload,
          triggerEventType: event.eventType,
          triggerEntityId: String(event.entityId),
          status: 'pending',
          createdBy: 'system',
        });
        broadcastWidgetData(canvas.organizationId, canvas._id, {
          type: 'suggestion.created',
          message: suggestion.message,
        });
      }
    }
  }
}

function registerAutomation() {
  if (!isAstraStudioEnabled()) return;
  try {
    const domainEvents = require('../domainEvents');
    domainEvents.subscribe((event) => {
      void handleDomainEvent(event).catch((err) => {
        console.warn('[astra-studio] automation error:', err.message);
      });
    });
  } catch (err) {
    console.warn('[astra-studio] failed to subscribe domain events:', err.message);
  }
}

module.exports = {
  handleDomainEvent,
  registerAutomation,
  canvasTouchesEntity,
  suggestionForEvent,
};
