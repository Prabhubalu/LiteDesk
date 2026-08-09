import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { getApiUrlForEventSource } from '@/config/apiBase';
import {
  createClientToken,
  hangUpCall,
  holdCall,
  muteCall,
  placeCall,
} from '@/utils/telephonyApi';
import {
  registerClickToCallHandlers,
  unregisterClickToCallHandlers,
  formatPhoneForDial,
} from '@/utils/clickToCall';

/** Shared softphone state (singleton across mounts). */
const device = shallowRef(null);
const twilioCall = shallowRef(null);
const activeCall = ref(null);
const muted = ref(false);
const onHold = ref(false);
const status = ref('idle'); // idle | connecting | ringing | in-call
const dialNumber = ref('');
const elapsedSeconds = ref(0);
const dockOpen = ref(true);
const dockMinimized = ref(false);
const incomingEvent = ref(null);
const postCallCallId = ref(null);
const lastError = ref('');
const deviceReady = ref(false);

let timerId = null;
let eventSource = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let registered = false;

function clearTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  clearTimer();
  elapsedSeconds.value = 0;
  timerId = setInterval(() => {
    elapsedSeconds.value += 1;
  }, 1000);
}

function stopCallLocal() {
  clearTimer();
  twilioCall.value = null;
  status.value = 'idle';
  muted.value = false;
  onHold.value = false;
}

function formatElapsed() {
  const total = elapsedSeconds.value;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function connectDevice() {
  lastError.value = '';
  try {
    const DeviceCtor = (await import('@twilio/voice-sdk')).Device;
    const res = await createClientToken();
    const token = res?.data?.token;
    if (!token) {
      deviceReady.value = false;
      return false;
    }
    if (device.value) {
      try {
        device.value.destroy();
      } catch {
        /* ignore */
      }
      device.value = null;
    }
    const d = new DeviceCtor(token, { logLevel: 1 });
    d.on('registered', () => {
      deviceReady.value = true;
    });
    d.on('unregistered', () => {
      deviceReady.value = false;
    });
    d.on('error', (err) => {
      lastError.value = err?.message || 'Device error';
      deviceReady.value = false;
    });
    d.on('incoming', (call) => {
      twilioCall.value = call;
      status.value = 'ringing';
      call.on('accept', () => {
        status.value = 'in-call';
        startTimer();
      });
      call.on('disconnect', () => {
        const callId = activeCall.value?._id || activeCall.value?.id || null;
        stopCallLocal();
        if (callId) postCallCallId.value = String(callId);
      });
    });
    await d.register();
    device.value = d;
    deviceReady.value = true;
    return true;
  } catch (err) {
    lastError.value = err?.message || 'Failed to connect device';
    deviceReady.value = false;
    return false;
  }
}

async function dial(number) {
  const to = formatPhoneForDial(number || dialNumber.value);
  if (!to) return null;
  lastError.value = '';
  dialNumber.value = to;
  status.value = 'connecting';

  if (deviceReady.value && device.value) {
    try {
      const call = await device.value.connect({ params: { To: to } });
      twilioCall.value = call;
      status.value = 'in-call';
      startTimer();
      call.on('disconnect', () => {
        const callId = activeCall.value?._id || activeCall.value?.id || null;
        stopCallLocal();
        if (callId) postCallCallId.value = String(callId);
      });
      // Also create server-side call record for CRM linkage
      try {
        const res = await placeCall({ to });
        activeCall.value = res?.data || null;
      } catch {
        /* softphone media can proceed without CRM row */
      }
      return activeCall.value;
    } catch (err) {
      lastError.value = err?.message || 'Dial failed';
      // fall through to server-side placeCall
    }
  }

  try {
    const res = await placeCall({ to });
    activeCall.value = res?.data || null;
    status.value = 'in-call';
    startTimer();
    return activeCall.value;
  } catch (err) {
    status.value = 'idle';
    lastError.value = err?.response?.data?.message || err?.message || 'Dial failed';
    throw err;
  }
}

async function hangup() {
  const callId = activeCall.value?._id || activeCall.value?.id;
  try {
    if (twilioCall.value) {
      twilioCall.value.disconnect();
    }
    if (callId) {
      await hangUpCall(callId);
    }
  } catch (err) {
    lastError.value = err?.message || 'Hangup failed';
  } finally {
    if (callId) postCallCallId.value = String(callId);
    stopCallLocal();
    activeCall.value = null;
  }
}

async function toggleMute() {
  const next = !muted.value;
  if (twilioCall.value) {
    twilioCall.value.mute(next);
    muted.value = next;
    return;
  }
  const callId = activeCall.value?._id || activeCall.value?.id;
  if (!callId) return;
  try {
    await muteCall(callId);
    muted.value = next;
  } catch (err) {
    lastError.value = err?.message || 'Mute failed';
  }
}

async function toggleHold() {
  const callId = activeCall.value?._id || activeCall.value?.id;
  if (!callId && !twilioCall.value) return;
  try {
    if (callId) await holdCall(callId);
    onHold.value = !onHold.value;
  } catch (err) {
    lastError.value = err?.message || 'Hold failed';
  }
}

function acceptIncomingTwilio() {
  if (twilioCall.value) {
    twilioCall.value.accept();
    status.value = 'in-call';
    startTimer();
  }
  incomingEvent.value = null;
}

async function declineIncoming() {
  const callId = incomingEvent.value?.callId;
  if (twilioCall.value) {
    try {
      twilioCall.value.reject();
    } catch {
      /* ignore */
    }
    twilioCall.value = null;
  }
  if (callId) {
    try {
      await hangUpCall(callId);
    } catch {
      /* ignore */
    }
  }
  incomingEvent.value = null;
  status.value = 'idle';
}

function handleSseMessage(raw) {
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const type = payload?.type || payload?.event;
  if (type === 'IncomingCall') {
    incomingEvent.value = payload;
    status.value = 'ringing';
    if (payload.callId) {
      activeCall.value = { _id: payload.callId, ...(activeCall.value || {}) };
    }
  } else if (type === 'CallAnswered') {
    status.value = 'in-call';
    if (!timerId) startTimer();
    incomingEvent.value = null;
  } else if (type === 'CallEnded' || type === 'CallMissed') {
    const callId =
      payload?.callId || activeCall.value?._id || activeCall.value?.id || null;
    stopCallLocal();
    if (callId && type === 'CallEnded') {
      postCallCallId.value = String(callId);
    }
    activeCall.value = null;
    incomingEvent.value = null;
  }
}

function connectStream() {
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  if (!token || typeof EventSource === 'undefined') return;

  if (eventSource) {
    try {
      eventSource.close();
    } catch {
      /* ignore */
    }
    eventSource = null;
  }

  const url = getApiUrlForEventSource(
    `/api/telephony/stream?token=${encodeURIComponent(token)}`
  );
  const es = new EventSource(url, { withCredentials: true });
  eventSource = es;

  es.onopen = () => {
    reconnectAttempt = 0;
  };

  es.onmessage = (ev) => {
    if (ev?.data) handleSseMessage(ev.data);
  };

  // Hub writes `event: telephony` with JSON payload `{ type, ... }`
  es.addEventListener('telephony', (ev) => {
    if (ev?.data) handleSseMessage(ev.data);
  });

  es.onerror = () => {
    try {
      es.close();
    } catch {
      /* ignore */
    }
    eventSource = null;
    const delay = Math.min(30000, 1000 * 2 ** reconnectAttempt);
    reconnectAttempt += 1;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (useAuthStore().isAuthenticated) connectStream();
    }, delay);
  };
}

function disconnectStream() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    try {
      eventSource.close();
    } catch {
      /* ignore */
    }
    eventSource = null;
  }
}

function openDock() {
  dockOpen.value = true;
  dockMinimized.value = false;
}

/**
 * Softphone composable — shared singleton state.
 */
export function useTelephonySoftphone() {
  if (!registered) {
    registerClickToCallHandlers({
      dial: (n) => dial(n),
      open: openDock,
    });
    registered = true;
  }

  onBeforeUnmount(() => {
    // Keep singleton alive while entitled chrome is mounted; cleanup only via destroySoftphone.
  });

  return {
    device,
    twilioCall,
    activeCall,
    muted,
    onHold,
    status,
    dialNumber,
    elapsedSeconds,
    elapsedLabel: computed(() => formatElapsed()),
    dockOpen,
    dockMinimized,
    incomingEvent,
    postCallCallId,
    lastError,
    deviceReady,
    connectDevice,
    connectStream,
    disconnectStream,
    dial,
    hangup,
    toggleMute,
    toggleHold,
    acceptIncomingTwilio,
    declineIncoming,
    openDock,
    formatPhoneForDial,
  };
}

export function destroySoftphone() {
  disconnectStream();
  clearTimer();
  if (device.value) {
    try {
      device.value.destroy();
    } catch {
      /* ignore */
    }
    device.value = null;
  }
  unregisterClickToCallHandlers();
  registered = false;
  deviceReady.value = false;
  stopCallLocal();
  activeCall.value = null;
  incomingEvent.value = null;
}
