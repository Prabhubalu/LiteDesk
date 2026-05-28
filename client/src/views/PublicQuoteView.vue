<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div class="mx-auto max-w-4xl px-4 py-10">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-xs text-gray-500">Quote</div>
          <div class="mt-1 text-2xl font-semibold truncate">
            {{ headerTitle }}
          </div>
          <div v-if="quote?.quoteTitle" class="mt-1 text-sm text-gray-600 truncate">
            {{ quote.quoteTitle }}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 justify-end">
          <button
            v-if="canCustomerAct"
            type="button"
            class="inline-flex items-center rounded-md bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700"
            :disabled="loading || busy"
            @click="accept"
          >
            Accept
          </button>
          <button
            v-if="canCustomerAct"
            type="button"
            class="inline-flex items-center rounded-md bg-white border border-red-200 text-red-700 px-3 py-2 text-sm hover:bg-red-50"
            :disabled="loading || busy"
            @click="reject"
          >
            Reject
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-white border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            :disabled="loading"
            @click="downloadPdf"
          >
            Download PDF
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-indigo-600 text-white px-3 py-2 text-sm hover:bg-indigo-700"
            :disabled="loading"
            @click="copyLink"
          >
            Copy link
          </button>
        </div>
      </div>

      <div v-if="loading" class="mt-8 text-sm text-gray-600">
        Loading…
      </div>

      <div v-else-if="error" class="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {{ error }}
      </div>

      <div v-else class="mt-8 space-y-6">
        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div class="flex items-center justify-between gap-4">
              <div class="text-gray-500">Status</div>
              <div class="font-medium">{{ quote?.status || '—' }}</div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="text-gray-500">Revision</div>
              <div class="font-medium">{{ quote?.revisionNumber ?? '—' }}</div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="text-gray-500">Quote date</div>
              <div class="font-medium">{{ fmtDate(quote?.quoteDate) }}</div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="text-gray-500">Valid until</div>
              <div class="font-medium">{{ fmtDate(quote?.validUntil) }}</div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="text-gray-500">Organization</div>
              <div class="font-medium">{{ quote?.organization?.name || '—' }}</div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="text-gray-500">Contact</div>
              <div class="font-medium">{{ contactLabel }}</div>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-200">
            <div class="text-sm font-medium">Line items</div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 text-gray-600">
                <tr>
                  <th class="px-4 py-2 text-left font-normal">SKU</th>
                  <th class="px-4 py-2 text-left font-normal">Name</th>
                  <th class="px-4 py-2 text-right font-normal">Qty</th>
                  <th class="px-4 py-2 text-right font-normal">Unit</th>
                  <th class="px-4 py-2 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-if="!lines.length" class="text-gray-500">
                  <td class="px-4 py-3" colspan="5">No lines</td>
                </tr>
                <tr v-for="l in lines" :key="l.quoteLineId">
                  <td class="px-4 py-2 font-mono text-xs text-gray-600">{{ l.skuSnapshot || '—' }}</td>
                  <td class="px-4 py-2">
                    <div class="min-w-0">
                      <div
                        class="truncate"
                        :class="{
                          'font-semibold': l.lineType === 'bundle_parent',
                          'pl-4 text-gray-800': l.lineType === 'bundle_component'
                        }"
                      >
                        <span v-if="l.lineType === 'bundle_component'" class="text-gray-400 mr-1">↳</span>
                        <span v-if="l.isOptional" class="text-xs text-gray-500 mr-1">[Optional]</span>
                        {{ l.itemNameSnapshot || '—' }}
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-right">{{ l.quantity ?? '—' }}</td>
                  <td class="px-4 py-2 text-right">{{ fmtMoney(l.unitPriceSnapshot) }}</td>
                  <td class="px-4 py-2 text-right font-medium">{{ fmtMoney(l.lineTotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex justify-end">
          <div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <div class="text-gray-500">Subtotal</div>
              <div class="font-medium">{{ fmtMoney(quote?.subtotal) }}</div>
            </div>
            <div class="flex items-center justify-between text-sm">
              <div class="text-gray-500">Tax</div>
              <div class="font-medium">{{ fmtMoney(quote?.taxTotal) }}</div>
            </div>
            <div class="flex items-center justify-between text-base">
              <div class="text-gray-900 font-semibold">Grand total</div>
              <div class="text-gray-900 font-semibold">{{ fmtMoney(quote?.grandTotal) }}</div>
            </div>
            <div v-if="currency" class="pt-1 text-xs text-gray-500 text-right">
              Currency: {{ currency }}
            </div>
          </div>
        </div>

        <div class="pt-2 text-xs text-gray-400">
          Shared link • Read-only
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';

const route = useRoute();
const token = computed(() => String(route.params.token || '').trim());

const loading = ref(true);
const busy = ref(false);
const error = ref('');
const quote = ref(null);
const lines = ref([]);

const currency = computed(() => String(quote.value?.currency || '').trim());

const headerTitle = computed(() => {
  const q = quote.value || {};
  return q.quoteNumber || 'Quote';
});

const contactLabel = computed(() => {
  const c = quote.value?.contact;
  if (!c) return '—';
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.email || '—';
});

const canCustomerAct = computed(() => {
  const s = String(quote.value?.status || '');
  return s === 'Sent' || s === 'Viewed';
});

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function fmtMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}${currency.value ? ` ${currency.value}` : ''}`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    if (!token.value) {
      error.value = 'Invalid link';
      return;
    }
    const res = await apiClient.get(`/public/quotes/${token.value}/view`);
    if (!res?.success) {
      error.value = res?.message || 'Failed to load quote';
      return;
    }
    quote.value = res?.data?.quote || null;
    const raw = Array.isArray(res?.data?.lines) ? res.data.lines : [];
    // Normalize optional bundle component hint
    lines.value = raw.map((l) => ({
      ...l,
      isOptional: l?.bundleOptional === true || l?.isOptional === true || false
    }));
  } catch (e) {
    const msg = e?.is404 ? 'Quote link not found' : (e?.message || 'Failed to load quote');
    error.value = msg;
  } finally {
    loading.value = false;
  }
}

function downloadPdf() {
  if (!token.value) return;
  window.open(`/api/public/quotes/${token.value}/pdf`, '_blank');
}

async function copyLink() {
  const url = `${window.location.origin}/public/quotes/${token.value}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // ignore
  }
}

async function accept() {
  if (!token.value) return;
  if (!window.confirm('Accept this quote?')) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/public/quotes/${token.value}/accept`, {});
    if (!res?.success) {
      error.value = res?.message || 'Failed to accept';
      return;
    }
    await load();
  } catch (e) {
    error.value = e?.message || 'Failed to accept';
  } finally {
    busy.value = false;
  }
}

async function reject() {
  if (!token.value) return;
  if (!window.confirm('Reject this quote?')) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/public/quotes/${token.value}/reject`, {});
    if (!res?.success) {
      error.value = res?.message || 'Failed to reject';
      return;
    }
    await load();
  } catch (e) {
    error.value = e?.message || 'Failed to reject';
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

