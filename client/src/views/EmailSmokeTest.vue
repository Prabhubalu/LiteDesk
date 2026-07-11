<script setup>
import { onMounted, ref, watch } from 'vue'
import apiClient from '@/utils/apiClient'

const sending = ref(false)
const result = ref(null)
const errorMessage = ref('')
const loadingRecords = ref(false)
const recordOptions = ref([])

const standaloneWorkspaceSend = ref(false)

const form = ref({
  moduleKey: 'people',
  recordId: '',
  to: '',
  subject: 'Arivu email smoke test',
  body: '<p>Hello from Arivu email smoke test UI.</p>'
})

const MODULE_ENDPOINT_MAP = {
  people: '/people',
  organizations: '/v2/organization',
  deals: '/deals',
  tasks: '/tasks',
  cases: '/helpdesk/cases'
}

function normalizeRecords(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.records)) return payload.data.records
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload?.records)) return payload.records
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function getRecordLabel(item, moduleKey) {
  if (!item || typeof item !== 'object') return '(unknown)'

  if (moduleKey === 'people') {
    const name = [item.firstName || item.first_name, item.lastName || item.last_name].filter(Boolean).join(' ').trim()
    return name || item.email || item._id || '(person)'
  }

  if (moduleKey === 'organizations') {
    return item.name || item.organizationName || item.displayName || item._id || '(organization)'
  }

  if (moduleKey === 'deals') {
    return item.name || item.title || item.dealName || item._id || '(deal)'
  }

  if (moduleKey === 'tasks') {
    return item.title || item.name || item.subject || item._id || '(task)'
  }

  if (moduleKey === 'cases') {
    return item.title || item.subject || item.caseNumber || item._id || '(case)'
  }

  return item.name || item.title || item._id || '(record)'
}

async function loadRecordOptions() {
  const moduleKey = form.value.moduleKey
  const endpoint = MODULE_ENDPOINT_MAP[moduleKey]
  if (!endpoint) {
    recordOptions.value = []
    return
  }

  loadingRecords.value = true
  try {
    const response = await apiClient.get(endpoint, {
      params: { limit: 50, page: 1 }
    })
    const records = normalizeRecords(response)
    recordOptions.value = records
      .filter((item) => item && item._id)
      .map((item) => ({
        id: String(item._id),
        label: getRecordLabel(item, moduleKey)
      }))
    if (recordOptions.value.length > 0 && !form.value.recordId) {
      form.value.recordId = recordOptions.value[0].id
    }
  } catch (err) {
    recordOptions.value = []
    errorMessage.value = `Failed to load ${moduleKey} records: ${err?.message || 'Unknown error'}`
  } finally {
    loadingRecords.value = false
  }
}

async function onSubmit() {
  errorMessage.value = ''
  result.value = null

  const toList = String(form.value.to || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (!standaloneWorkspaceSend.value && !form.value.recordId.trim()) {
    errorMessage.value = 'Record ID is required.'
    return
  }

  if (toList.length === 0) {
    errorMessage.value = 'At least one recipient email is required.'
    return
  }

  sending.value = true
  try {
    const payload = standaloneWorkspaceSend.value
      ? {
          standalone: true,
          to: toList,
          subject: form.value.subject.trim(),
          body: form.value.body
        }
      : {
          relatedTo: {
            moduleKey: form.value.moduleKey,
            recordId: form.value.recordId.trim()
          },
          to: toList,
          subject: form.value.subject.trim(),
          body: form.value.body
        }

    const response = await apiClient.post('/communications/email', payload)
    result.value = response
  } catch (err) {
    const validationErrors = err?.response?.data?.errors
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      errorMessage.value = validationErrors.join(' | ')
    } else {
      errorMessage.value = err?.message || 'Failed to send test email.'
    }
  } finally {
    sending.value = false
  }
}

watch(
  () => form.value.moduleKey,
  async () => {
    form.value.recordId = ''
    await loadRecordOptions()
  }
)

onMounted(async () => {
  await loadRecordOptions()
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl p-6">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Email Smoke Test</h1>
    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
      Sends via <code>/api/communications/email</code>. Use record mode, or Inbox standalone (workspace-scoped) when enabled by policy.
    </p>

    <form class="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" @submit.prevent="onSubmit">
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input v-model="standaloneWorkspaceSend" type="checkbox" class="rounded border-gray-300 dark:border-gray-600" />
        Inbox standalone send (<code>standalone: true</code>, no record)
      </label>

      <div v-if="!standaloneWorkspaceSend" class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-gray-700 dark:text-gray-300">Module Key</span>
          <select v-model="form.moduleKey" class="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
            <option value="people">people</option>
            <option value="organizations">organizations</option>
            <option value="deals">deals</option>
            <option value="tasks">tasks</option>
            <option value="cases">cases</option>
          </select>
        </label>

        <label class="flex flex-col gap-1 text-sm">
          <span class="text-gray-700 dark:text-gray-300">Select Record</span>
          <select
            v-model="form.recordId"
            class="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            :disabled="loadingRecords"
          >
            <option value="" disabled>
              {{ loadingRecords ? 'Loading records...' : 'Select a record' }}
            </option>
            <option
              v-for="option in recordOptions"
              :key="option.id"
              :value="option.id"
            >
              {{ option.label }} ({{ option.id }})
            </option>
          </select>
        </label>
      </div>

      <label v-if="!standaloneWorkspaceSend" class="flex flex-col gap-1 text-sm">
        <span class="text-gray-700 dark:text-gray-300">Record ID (manual override)</span>
        <input
          v-model="form.recordId"
          type="text"
          class="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          placeholder="Mongo ObjectId"
        />
      </label>

      <div v-if="recordOptions.length === 0 && !loadingRecords" class="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
        No records loaded for {{ form.moduleKey }}. You can paste a valid ID manually.
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-gray-700 dark:text-gray-300">To (comma-separated)</span>
        <input
          v-model="form.to"
          type="text"
          class="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          placeholder="name@example.com, other@example.com"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-gray-700 dark:text-gray-300">Subject</span>
        <input
          v-model="form.subject"
          type="text"
          class="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-gray-700 dark:text-gray-300">HTML Body</span>
        <textarea
          v-model="form.body"
          rows="6"
          class="rounded border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800"
        />
      </label>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="sending"
          class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ sending ? 'Sending...' : 'Send Test Email' }}
        </button>
        <button
          type="button"
          :disabled="loadingRecords"
          class="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200"
          @click="loadRecordOptions"
        >
          {{ loadingRecords ? 'Refreshing...' : 'Refresh Records' }}
        </button>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          Uses authenticated API call with your current session token.
        </span>
      </div>
    </form>

    <div v-if="errorMessage" class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="result" class="mt-4">
      <h2 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">API Response</h2>
      <pre class="overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-950">{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>
