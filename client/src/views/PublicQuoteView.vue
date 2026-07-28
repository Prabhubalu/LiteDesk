<template>
  <div
    class="min-h-screen bg-gray-50 text-gray-900 relative"
    :class="{ 'quote-public--draft': isDraftPreview }"
  >
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
          <template v-if="canCustomerAct">
            <button
              type="button"
              class="inline-flex items-center rounded-md bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700"
              :disabled="loading || busy || !canSubmitAcceptance"
              @click="submitAcceptance"
            >
              {{ acceptButtonLabel }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-md bg-white border border-red-200 text-red-700 px-3 py-2 text-sm hover:bg-red-50"
              :disabled="loading || busy"
              @click="showRejectModal = true"
            >
              Reject
            </button>
          </template>
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
        <div
          v-if="isDraftPreview"
          class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p class="font-semibold">Draft — for discussion only</p>
          <p class="mt-1 text-amber-900/90">
            This is not a final quote. Pricing and terms may change. Acceptance is not available until a formal quote is issued.
          </p>
        </div>

        <div
          v-else-if="portalExpired"
          class="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950"
          role="status"
        >
          <p class="font-semibold">This quote has expired</p>
          <p class="mt-1 text-red-900/90">
            The validity date has passed. Acceptance is no longer available. Contact your sales representative to request a new quote or revision.
          </p>
        </div>

        <div
          v-else-if="responseBanner"
          class="rounded-xl border px-4 py-3 text-sm"
          :class="responseBanner.class"
          role="status"
        >
          <p class="font-semibold">{{ responseBanner.title }}</p>
          <p v-if="responseBanner.detail" class="mt-1 opacity-90">{{ responseBanner.detail }}</p>
        </div>

        <div
          v-if="canCustomerAct && allowPartialAccept"
          class="rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950"
        >
          <p class="font-medium">Partial acceptance</p>
          <p class="mt-1 text-indigo-900/90">
            Uncheck any lines you are not accepting. All selected lines must be accepted together.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              class="text-xs font-medium text-indigo-700 underline"
              @click="selectAllLines"
            >
              Select all
            </button>
            <button
              type="button"
              class="text-xs font-medium text-indigo-700 underline"
              @click="clearLineSelection"
            >
              Clear all
            </button>
          </div>
        </div>

        <div
          v-if="canCustomerAct"
          class="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
        >
          <div
            v-if="requireCustomerAgreement"
            class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3"
          >
            <label class="flex items-start gap-3 cursor-pointer">
              <input
                v-model="agreedToTerms"
                type="checkbox"
                class="mt-1 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span class="text-sm text-gray-800">{{ customerAgreementText }}</span>
            </label>
          </div>
          <div v-if="requireTypedSignature" class="space-y-1">
            <label class="block text-sm font-medium text-gray-700">
              Type your full name to sign
            </label>
            <input
              v-model="signatureText"
              type="text"
              autocomplete="name"
              class="quote-signature-input w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-xl"
              placeholder="Your full name"
            />
            <p class="text-xs text-gray-500">
              By typing your name, you agree this constitutes your electronic signature.
            </p>
          </div>
          <label
            v-if="!requireTypedSignature"
            class="block text-sm font-medium text-gray-700"
          >
            {{ requireCustomerAgreement ? 'Your name' : 'Your name (optional)' }}
          </label>
          <input
            v-if="!requireTypedSignature"
            v-model="signerName"
            type="text"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            :placeholder="requireCustomerAgreement ? 'Printed name' : 'Printed name for acknowledgment'"
          />
          <label class="block text-sm font-medium text-gray-700">Comment (optional)</label>
          <textarea
            v-model="acceptComment"
            rows="2"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Add a note with your acceptance"
          />
        </div>

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
          <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-2">
            <div class="text-sm font-medium">Line items</div>
            <div v-if="canCustomerAct && selectionSummary" class="text-xs text-gray-500">
              {{ selectionSummary }}
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 text-gray-600">
                <tr>
                  <th v-if="canCustomerAct && allowPartialAccept" class="px-3 py-2 w-10" />
                  <th class="px-4 py-2 text-left font-normal">SKU</th>
                  <th class="px-4 py-2 text-left font-normal">Name</th>
                  <th class="px-4 py-2 text-right font-normal">Qty</th>
                  <th class="px-4 py-2 text-right font-normal">Unit</th>
                  <th class="px-4 py-2 text-right font-normal">Total</th>
                </tr>
              </thead>
              <template v-if="!lines.length">
                <tbody>
                  <tr class="text-gray-500">
                    <td class="px-4 py-3" :colspan="lineTableColspan">No lines</td>
                  </tr>
                </tbody>
              </template>
              <template v-for="block in sectionBlocks" v-else :key="block.key">
                <tbody v-if="block.section" class="border-t border-gray-200">
                  <tr class="bg-gray-50/90">
                    <td v-if="canCustomerAct && allowPartialAccept" class="px-3 py-2 text-center align-middle">
                      <input
                        v-if="sectionSelectableLines(block).length"
                        type="checkbox"
                        class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        :checked="isSectionSelected(block)"
                        @change="toggleSection(block)"
                      />
                    </td>
                    <td :colspan="sectionHeaderColspan" class="px-4 py-2.5">
                      <span class="font-semibold text-gray-900">{{ block.section.sectionTitle }}</span>
                      <span
                        v-if="sectionBadgeLabel(block.section)"
                        class="ml-2 inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700"
                      >
                        {{ sectionBadgeLabel(block.section) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
                <tbody class="divide-y divide-gray-100">
                  <tr
                    v-for="l in block.lines"
                    :key="l.quoteLineId"
                    :class="{
                      'bg-emerald-50/60': isLineAccepted(l),
                      'opacity-60': canCustomerAct && allowPartialAccept && l.selectable && !isLineSelected(l)
                    }"
                  >
                    <td v-if="canCustomerAct && allowPartialAccept" class="px-3 py-2 text-center">
                      <input
                        v-if="l.selectable"
                        type="checkbox"
                        class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        :checked="isLineSelected(l)"
                        @change="toggleLine(l)"
                      />
                    </td>
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
                  <tr
                    v-if="shouldShowSectionTotal(block.section)"
                    class="bg-gray-50/80 border-t border-gray-100"
                  >
                    <td :colspan="lineTableColspan" class="px-4 py-2.5">
                      <div class="flex flex-col items-end gap-0.5 text-xs text-gray-600">
                        <div
                          v-if="Number(block.section.sectionDiscountTotal) > 0"
                          class="flex items-center justify-end gap-6 w-full max-w-xs"
                        >
                          <span>Section subtotal</span>
                          <span class="font-medium text-gray-900 tabular-nums">
                            {{ fmtMoney(block.section.sectionSubtotal) }}
                          </span>
                        </div>
                        <div
                          v-if="Number(block.section.sectionDiscountTotal) > 0"
                          class="flex items-center justify-end gap-6 w-full max-w-xs"
                        >
                          <span>Section discount</span>
                          <span class="font-medium text-gray-900 tabular-nums">
                            -{{ fmtMoney(block.section.sectionDiscountTotal) }}
                          </span>
                        </div>
                        <div class="flex items-center justify-end gap-6 w-full max-w-xs font-medium text-gray-900">
                          <span>Section total</span>
                          <span class="tabular-nums">
                            {{ fmtMoney(block.section.sectionTotal ?? block.section.sectionSubtotal) }}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </template>
            </table>
          </div>
        </div>

        <div class="flex justify-end">
          <div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <div class="text-gray-500">Subtotal</div>
              <div class="font-medium">{{ fmtMoney(displayTotals.subtotal) }}</div>
            </div>
            <div class="flex items-center justify-between text-sm">
              <div class="text-gray-500">Tax</div>
              <div class="font-medium">{{ fmtMoney(displayTotals.tax) }}</div>
            </div>
            <div class="flex items-center justify-between text-base">
              <div class="text-gray-900 font-semibold">Grand total</div>
              <div class="text-gray-900 font-semibold">{{ fmtMoney(displayTotals.grand) }}</div>
            </div>
            <p v-if="canCustomerAct && allowPartialAccept && selectedLineIds.size < selectableLineCount" class="text-xs text-violet-700 text-right">
              Totals reflect selected lines only
            </p>
            <div v-if="currency" class="pt-1 text-xs text-gray-500 text-right">
              Currency: {{ currency }}
            </div>
          </div>
        </div>

        <div
          v-if="commentsEnabled"
          class="rounded-xl border border-gray-200 bg-white overflow-hidden"
        >
          <div class="px-5 py-4 border-b border-gray-200">
            <div class="text-sm font-medium text-gray-900">Messages</div>
            <p class="mt-0.5 text-xs text-gray-500">Ask questions or reply to your sales contact.</p>
          </div>
          <div class="px-5 py-4 max-h-72 overflow-y-auto space-y-3">
            <p v-if="commentsLoading" class="text-sm text-gray-500">Loading messages…</p>
            <p v-else-if="!portalComments.length" class="text-sm text-gray-500 italic">No messages yet.</p>
            <div
              v-for="c in portalComments"
              :key="c.id"
              class="rounded-lg px-3 py-2 text-sm"
              :class="c.isCustomer ? 'bg-emerald-50 text-emerald-950' : 'bg-gray-50 text-gray-900'"
            >
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-medium text-xs">{{ c.authorLabel }}</span>
                <span class="text-xs text-gray-500 shrink-0">{{ fmtCommentTime(c.createdAt) }}</span>
              </div>
              <p class="mt-1 whitespace-pre-wrap break-words">{{ c.content }}</p>
            </div>
          </div>
          <form
            v-if="!isDraftPreview && !portalExpired"
            class="px-5 py-4 border-t border-gray-200 space-y-3 bg-gray-50/80"
            @submit.prevent="submitPortalComment"
          >
            <label class="block text-xs font-medium text-gray-600">Your name (optional)</label>
            <input
              v-model="commentSignerName"
              type="text"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              placeholder="How we should show your name"
            />
            <label class="block text-xs font-medium text-gray-600">Message</label>
            <textarea
              v-model="commentDraft"
              rows="2"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              placeholder="Type your message…"
              :disabled="commentBusy"
            />
            <div class="flex justify-end">
              <button
                type="submit"
                class="inline-flex items-center rounded-md bg-indigo-600 text-white px-3 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
                :disabled="commentBusy || !commentDraft.trim()"
              >
                Send message
              </button>
            </div>
          </form>
        </div>

        <div class="pt-2 text-xs text-gray-400">
          Shared link • {{ canCustomerAct ? 'You may accept or reject this quote below' : 'Read-only' }}
        </div>
      </div>
    </div>

    <!-- Reject modal -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      @click.self="showRejectModal = false"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 class="text-lg font-semibold text-gray-900">Reject quote</h3>
        <p class="mt-1 text-sm text-gray-600">Tell us why you are declining (optional).</p>
        <label class="mt-4 block text-sm font-medium text-gray-700">Your name (optional)</label>
        <input
          v-model="signerName"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <label class="mt-3 block text-sm font-medium text-gray-700">Comment</label>
        <textarea
          v-model="rejectComment"
          rows="3"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Reason for rejection"
        />
        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            @click="showRejectModal = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
            :disabled="busy"
            @click="confirmReject"
          >
            Reject quote
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { formatQuoteMoney } from '@/utils/quoteMoney';
import { buildPublicQuoteUrl, copyTextToClipboardWithinGesture } from '@/utils/copyToClipboard';
import {
  groupLinesByQuoteSection,
  sectionTypeBadgeKey
} from '@/utils/quoteSectionDisplay';

import { confirmAction } from '@/composables/useConfirmAction';
const route = useRoute();
const token = computed(() => String(route.params.token || '').trim());

const loading = ref(true);
const busy = ref(false);
const error = ref('');
const quote = ref(null);
const lines = ref([]);
const sections = ref([]);
const portal = ref(null);

const selectedLineIds = ref(new Set());
const signerName = ref('');
const acceptComment = ref('');
const agreedToTerms = ref(false);
const signatureText = ref('');
const rejectComment = ref('');
const showRejectModal = ref(false);
const portalComments = ref([]);
const commentsLoading = ref(false);
const commentBusy = ref(false);
const commentDraft = ref('');
const commentSignerName = ref('');

const currency = computed(() => String(quote.value?.currency || '').trim());

const sectionBlocks = computed(() =>
  groupLinesByQuoteSection({ lines: lines.value, sections: sections.value })
);

function sectionBadgeLabel(section) {
  const key = sectionTypeBadgeKey(section?.sectionType);
  if (key === 'optional') return 'Optional';
  if (key === 'future') return 'Future';
  return null;
}

function shouldShowSectionTotal(section) {
  return section && section.showSectionTotal !== false;
}

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

const isDraftPreview = computed(() => quote.value?.isDraftPreview === true);

const canCustomerAct = computed(() => portal.value?.canRespond === true);

const commentsEnabled = computed(() => portal.value?.commentsEnabled === true);

const portalExpired = computed(() => portal.value?.isExpired === true);

const allowPartialAccept = computed(() => portal.value?.allowPartialAccept === true);

const lineTableColspan = computed(() => (canCustomerAct.value && allowPartialAccept.value ? 6 : 5));

const sectionHeaderColspan = computed(() =>
  canCustomerAct.value && allowPartialAccept.value ? lineTableColspan.value - 1 : lineTableColspan.value
);

const requireCustomerAgreement = computed(() => portal.value?.requireCustomerAgreement === true);

const requireTypedSignature = computed(() => portal.value?.requireTypedSignature === true);

const customerAgreementText = computed(() => {
  const text = String(portal.value?.customerAgreementText || '').trim();
  return text || 'I agree to the pricing and terms shown in this quote.';
});

const selectableLineCount = computed(() =>
  lines.value.filter((l) => l.selectable).length
);

const canSubmitAcceptance = computed(() => {
  if (!canCustomerAct.value) return false;
  if (requireCustomerAgreement.value && !agreedToTerms.value) return false;
  if (requireTypedSignature.value && String(signatureText.value || '').trim().length < 2) return false;
  if (!allowPartialAccept.value) return true;
  return selectedLineIds.value.size > 0;
});

const acceptButtonLabel = computed(() => {
  if (!allowPartialAccept.value) return 'Accept quote';
  if (selectedLineIds.value.size === selectableLineCount.value) return 'Accept quote';
  return 'Accept selected lines';
});

const selectionSummary = computed(() => {
  if (!allowPartialAccept.value) return '';
  return `${selectedLineIds.value.size} of ${selectableLineCount.value} lines selected`;
});

const displayTotals = computed(() => {
  if (!canCustomerAct.value || !allowPartialAccept.value) {
    return {
      subtotal: quote.value?.subtotal,
      tax: quote.value?.taxTotal,
      grand: quote.value?.grandTotal
    };
  }
  let subtotal = 0;
  let tax = 0;
  let grand = 0;
  const selectedParents = new Set(
    lines.value.filter((l) => l.selectable && selectedLineIds.value.has(l.quoteLineId)).map((l) => l.quoteLineId)
  );
  for (const l of lines.value) {
    if (l.selectable) {
      if (!selectedLineIds.value.has(l.quoteLineId)) continue;
    } else if (l.lineType === 'bundle_component') {
      if (!l.parentQuoteLineId || !selectedParents.has(l.parentQuoteLineId)) continue;
    } else {
      continue;
    }
    subtotal += Number(l.lineSubtotal) || 0;
    tax += Number(l.lineTaxTotal) || 0;
    grand += Number(l.lineTotal) || 0;
  }
  return { subtotal, tax, grand };
});

const responseBanner = computed(() => {
  const cr = portal.value?.customerResponse;
  if (!cr?.responseType || canCustomerAct.value) return null;
  const type = String(cr.responseType).toLowerCase();
  if (type === 'rejected') {
    return {
      title: 'You rejected this quote',
      detail: cr.comment || null,
      class: 'border-red-200 bg-red-50 text-red-900'
    };
  }
  if (type === 'partial') {
    return {
      title: 'You partially accepted this quote',
      detail: cr.acceptedGrandTotal != null
        ? `Accepted total: ${fmtMoney(cr.acceptedGrandTotal)}`
        : null,
      class: 'border-violet-200 bg-violet-50 text-violet-900'
    };
  }
  if (type === 'full') {
    return {
      title: 'You accepted this quote',
      detail: null,
      class: 'border-emerald-200 bg-emerald-50 text-emerald-900'
    };
  }
  return null;
});

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function fmtMoney(v) {
  return formatQuoteMoney(v, currency.value);
}

function fmtCommentTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

async function loadComments() {
  if (!token.value || !commentsEnabled.value) {
    portalComments.value = [];
    return;
  }
  commentsLoading.value = true;
  try {
    const res = await apiClient.get(`/public/quotes/${token.value}/comments`);
    portalComments.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    portalComments.value = [];
  } finally {
    commentsLoading.value = false;
  }
}

async function submitPortalComment() {
  const text = commentDraft.value?.trim();
  if (!token.value || !text || commentBusy.value) return;
  commentBusy.value = true;
  try {
    const res = await apiClient.post(`/public/quotes/${token.value}/comments`, {
      content: text,
      signerName: commentSignerName.value?.trim() || signerName.value?.trim() || null
    });
    if (!res?.success) {
      error.value = res?.message || 'Failed to send message';
      return;
    }
    commentDraft.value = '';
    await loadComments();
  } catch (e) {
    error.value = e?.message || 'Failed to send message';
  } finally {
    commentBusy.value = false;
  }
}

function initSelectionFromLines() {
  const next = new Set();
  for (const l of lines.value) {
    if (l.selectable) next.add(l.quoteLineId);
  }
  selectedLineIds.value = next;
}

function isLineSelected(l) {
  return l.selectable && selectedLineIds.value.has(l.quoteLineId);
}

function isLineAccepted(l) {
  const cr = portal.value?.customerResponse;
  if (!cr?.acceptedLineIds?.length) return false;
  const ids = new Set(cr.acceptedLineIds.map(String));
  if (ids.has(String(l.quoteLineId))) return true;
  if (l.lineType === 'bundle_component' && l.parentQuoteLineId) {
    return ids.has(String(l.parentQuoteLineId));
  }
  return false;
}

function toggleLine(l) {
  if (!l.selectable) return;
  const next = new Set(selectedLineIds.value);
  if (next.has(l.quoteLineId)) next.delete(l.quoteLineId);
  else next.add(l.quoteLineId);
  selectedLineIds.value = next;
}

function sectionSelectableLines(block) {
  return (block?.lines || []).filter((l) => l?.selectable);
}

function isSectionSelected(block) {
  const selectable = sectionSelectableLines(block);
  if (!selectable.length) return false;
  return selectable.every((l) => selectedLineIds.value.has(l.quoteLineId));
}

function toggleSection(block) {
  const selectable = sectionSelectableLines(block);
  if (!selectable.length) return;
  const next = new Set(selectedLineIds.value);
  const allSelected = selectable.every((l) => next.has(l.quoteLineId));
  for (const l of selectable) {
    if (allSelected) next.delete(l.quoteLineId);
    else next.add(l.quoteLineId);
  }
  selectedLineIds.value = next;
}

function selectAllLines() {
  initSelectionFromLines();
}

function clearLineSelection() {
  selectedLineIds.value = new Set();
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
    portal.value = res?.data?.portal || null;
    sections.value = Array.isArray(res?.data?.sections) ? res.data.sections : [];
    const raw = Array.isArray(res?.data?.lines) ? res.data.lines : [];
    lines.value = raw.map((l) => ({
      ...l,
      isOptional: l?.bundleOptional === true || l?.isOptional === true || false,
      lineSubtotal: l.lineSubtotal,
      lineTaxTotal: l.lineTaxTotal
    }));
    initSelectionFromLines();
    await loadComments();
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
  if (!token.value) return;
  const url = buildPublicQuoteUrl(token.value);
  if (!copyTextToClipboardWithinGesture(url)) return;
}

async function submitAcceptance() {
  if (!token.value || !canSubmitAcceptance.value) return;
  const partial = allowPartialAccept.value && selectedLineIds.value.size < selectableLineCount.value;
  const msg = partial
    ? 'Accept the selected lines? This is a partial acceptance.'
    : 'Accept this quote in full?';
  if (!await confirmAction(msg)) return;

  busy.value = true;
  try {
    const body = {
      comment: acceptComment.value?.trim() || null,
      signerName: requireTypedSignature.value ? null : signerName.value?.trim() || null,
      signatureText: requireTypedSignature.value ? signatureText.value?.trim() || null : null,
      agreedToTerms: requireCustomerAgreement.value ? agreedToTerms.value === true : undefined
    };
    if (allowPartialAccept.value) {
      body.lineIds = [...selectedLineIds.value];
    }
    const res = await apiClient.post(`/public/quotes/${token.value}/accept`, body);
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

async function confirmReject() {
  if (!token.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/public/quotes/${token.value}/reject`, {
      comment: rejectComment.value?.trim() || null,
      signerName: signerName.value?.trim() || null
    });
    if (!res?.success) {
      error.value = res?.message || 'Failed to reject';
      return;
    }
    showRejectModal.value = false;
    await load();
  } catch (e) {
    error.value = e?.message || 'Failed to reject';
  } finally {
    busy.value = false;
  }
}

watch(lines, () => {
  if (canCustomerAct.value) initSelectionFromLines();
});

onMounted(load);
</script>

<style scoped>
.quote-public--draft::after {
  content: 'DRAFT';
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(4rem, 18vw, 10rem);
  font-weight: 700;
  color: rgb(220 38 38);
  opacity: 0.12;
  transform: rotate(-28deg);
  pointer-events: none;
  z-index: 40;
  user-select: none;
}

.quote-public--draft > div {
  position: relative;
  z-index: 1;
}

.quote-signature-input {
  font-family: 'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive;
  color: #1e3a5f;
  letter-spacing: 0.02em;
}
</style>
