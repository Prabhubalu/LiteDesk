<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-8">
      <router-link
        to="/control"
        class="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        ← Control Plane
      </router-link>
      <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">Inbound Parser</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Connect the CRM API server to your Arivu Inbound Parser on a separate host. Tenants never see these URLs — they only get per-mailbox forwarding addresses after creating mailboxes.
      </p>
    </div>

    <div
      v-if="loadError"
      class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
    >
      {{ loadError }}
    </div>

    <form
      v-else
      class="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      @submit.prevent="save"
    >
      <label class="flex items-center gap-3">
        <input v-model="form.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
        <span class="text-sm font-medium text-gray-900 dark:text-white">Enable inbound parser integration</span>
      </label>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Parser API base URL</label>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Root URL of the parser HTTP API — the prefix before
          <code class="font-mono">/integrations/v1/mailboxes</code>. Examples:
          <code class="font-mono">https://parser.arivusystems.com</code> or
          <code class="font-mono">https://parser.arivusystems.com/api</code> if routes are under
          <code class="font-mono">/api</code>. Use <strong>Test parser connection</strong> to verify.
        </p>
        <input
          v-model="form.parserApiBaseUrl"
          type="url"
          class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="https://parser.example.com"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">CRM public API base URL</label>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Public URL of <em>this</em> CRM API (where the parser POSTs webhooks), e.g.
          <code class="font-mono">https://api.arivusystems.com</code>
        </p>
        <input
          v-model="form.crmPublicApiBaseUrl"
          type="url"
          class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="https://api.arivusystems.com"
        />
      </div>

      <div v-if="effective.crmWebhookUrl" class="rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm dark:border-indigo-900 dark:bg-indigo-950/30">
        <div class="font-semibold text-indigo-900 dark:text-indigo-100">Copy into parser server <code class="text-xs">.env</code></div>
        <dl class="mt-2 space-y-2 text-xs text-indigo-950 dark:text-indigo-100">
          <div>
            <dt class="font-mono text-indigo-700 dark:text-indigo-300">CRM_WEBHOOK_URL</dt>
            <dd class="mt-0.5 break-all font-mono">{{ effective.crmWebhookUrl }}</dd>
          </div>
          <div v-if="effective.parserProvisionUrl">
            <dt class="font-mono text-indigo-700 dark:text-indigo-300">Parser provision endpoint (CRM → parser)</dt>
            <dd class="mt-0.5 break-all font-mono">{{ effective.parserProvisionUrl }}</dd>
          </div>
        </dl>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Parser API key</label>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Same as <code class="font-mono">CRM_API_KEY</code> on the parser. Leave blank to keep existing.
          <span v-if="config.hasParserApiKey" class="text-emerald-700 dark:text-emerald-400"> (saved)</span>
        </p>
        <input
          v-model="form.parserApiKey"
          type="password"
          autocomplete="new-password"
          class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Webhook HMAC secret</label>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Same as <code class="font-mono">CRM_WEBHOOK_SECRET</code> on the parser and <code class="font-mono">ARIVU_WEBHOOK_SECRET</code> here. Leave blank to keep existing.
          <span v-if="config.hasWebhookSecret" class="text-emerald-700 dark:text-emerald-400"> (saved)</span>
        </p>
        <input
          v-model="form.webhookSecret"
          type="password"
          autocomplete="new-password"
          class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          placeholder="••••••••"
        />
      </div>

      <div class="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          type="submit"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving"
        >
          {{ saving ? 'Saving…' : 'Save configuration' }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
          :disabled="testing"
          @click="testConnection"
        >
          {{ testing ? 'Testing…' : 'Test parser connection' }}
        </button>
      </div>

      <p v-if="testResult" class="text-sm" :class="testResult.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-200'">
        {{ testResult.message }}
      </p>

      <p v-if="effective.provisionReady" class="text-xs text-emerald-700 dark:text-emerald-400">
        Provisioning ready (source: {{ effective.source }}) — mailboxes can get forwarding addresses.
      </p>
      <p v-else-if="effective.configured" class="text-xs text-emerald-700 dark:text-emerald-400">
        Webhooks configured (source: {{ effective.source }}).
      </p>
      <p v-else-if="form.enabled" class="text-xs text-amber-800 dark:text-amber-200">
        Enabled but provisioning is not ready — set Parser API URL and API key (must match parser
        <code class="font-mono">CRM_API_KEY</code>), then click Save and Test parser connection.
      </p>
      <p
        v-if="config.parserKeyNeedsResave"
        class="text-xs text-red-700 dark:text-red-300"
      >
        A parser API key is saved but could not be read. Re-enter the key and save again (often
        caused by a changed <code class="font-mono">JWT_SECRET</code> on the CRM server).
      </p>
    </form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';

const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

const loadError = ref('');
const saving = ref(false);
const testing = ref(false);
const testResult = ref(null);

const config = reactive({
  hasParserApiKey: false,
  hasWebhookSecret: false,
  parserKeyNeedsResave: false,
  webhookSecretNeedsResave: false
});

const effective = reactive({
  crmWebhookUrl: '',
  parserProvisionUrl: '',
  configured: false,
  provisionReady: false,
  source: 'none'
});

const form = reactive({
  enabled: false,
  parserApiBaseUrl: '',
  crmPublicApiBaseUrl: '',
  parserApiKey: '',
  webhookSecret: ''
});

async function load() {
  loadError.value = '';
  try {
    const res = await apiClient('/platform/inbound-parser', { method: 'GET' });
    if (!res?.success) {
      loadError.value = res?.message || 'Failed to load configuration';
      return;
    }
    const data = res.data || {};
    form.enabled = Boolean(data.enabled);
    form.parserApiBaseUrl = data.parserApiBaseUrl || '';
    form.crmPublicApiBaseUrl = data.crmPublicApiBaseUrl || '';
    config.hasParserApiKey = Boolean(data.hasParserApiKey);
    config.hasWebhookSecret = Boolean(data.hasWebhookSecret);
    config.parserKeyNeedsResave = Boolean(data.parserKeyNeedsResave);
    config.webhookSecretNeedsResave = Boolean(data.webhookSecretNeedsResave);
    Object.assign(effective, data.effective || {});
  } catch (err) {
    loadError.value = err?.message || 'Failed to load configuration';
  }
}

async function save() {
  saving.value = true;
  try {
    const body = {
      enabled: form.enabled,
      parserApiBaseUrl: form.parserApiBaseUrl,
      crmPublicApiBaseUrl: form.crmPublicApiBaseUrl
    };
    if (form.parserApiKey) body.parserApiKey = form.parserApiKey;
    if (form.webhookSecret) body.webhookSecret = form.webhookSecret;
    const res = await apiClient('/platform/inbound-parser', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    if (res?.success) {
      notifications.success('Inbound parser configuration saved');
      form.parserApiKey = '';
      form.webhookSecret = '';
      await load();
    } else {
      notifications.error(res?.message || 'Save failed');
    }
  } catch (err) {
    notifications.error(err?.message || 'Save failed');
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    const res = await apiClient('/platform/inbound-parser/test-connection', { method: 'POST' });
    testResult.value = res?.data || { ok: res?.success, message: res?.message };
    if (res?.success) {
      notifications.success('Parser connection OK');
    } else {
      notifications.warning(testResult.value?.message || 'Connection test failed');
    }
  } catch (err) {
    testResult.value = { ok: false, message: err?.message || 'Test failed' };
  } finally {
    testing.value = false;
  }
}

onMounted(() => {
  document.title = 'Inbound Parser | Control Plane';
  if (!authStore.isPlatformAdmin) {
    router.push({ name: 'dashboard' });
    return;
  }
  void load();
});
</script>
