<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowRightIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CheckIcon,
  EnvelopeIcon,
  LinkIcon,
  PhoneIcon,
  TagIcon,
  UserIcon
} from '@heroicons/vue/24/outline'
import { fetchAssignableUsers, type TaskAssignee } from '@/api/tasks'
import {
  addPersonActivityLog,
  deletePerson,
  fetchPerson,
  fetchPersonActivityLogs,
  updatePerson,
  type PeopleActivityLog,
  type PeopleAssignee,
  type PeopleRecord
} from '@/api/people'
import MobileAvatar from '@/components/MobileAvatar.vue'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import MobileCommentComposer from '@/components/MobileCommentComposer.vue'
import MobileRecordBar from '@/components/MobileRecordBar.vue'
import MobileRecordFields from '@/components/MobileRecordFields.vue'
import MobileRichHtml from '@/components/MobileRichHtml.vue'
import ModuleIcon from '@/components/ModuleIcon.vue'
import { resolveAvatarUrl } from '@/utils/avatarUrl'
import { addRecent } from '@/services/recents'
import { useAuthStore } from '@/stores/auth'
import { useShellChrome } from '@/composables/useShellChrome'
import { tapHaptic } from '@/utils/haptics'
import { hasPermission } from '@/utils/permissions'
import { htmlToPlainText } from '@/utils/richHtml'

const props = defineProps<{ personId: string }>()

type RecordTab = 'summary' | 'activity'
type EditField = 'email' | 'phone' | 'jobTitle' | 'assignee' | 'description' | null

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'activity', label: 'Activity' }
]

const router = useRouter()
const auth = useAuthStore()
const chrome = useShellChrome()

const person = ref<PeopleRecord | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const tab = ref<RecordTab>('summary')

const activityLogs = ref<PeopleActivityLog[]>([])
const activityLoading = ref(false)
const activityError = ref<string | null>(null)
const activityLoaded = ref(false)
const commentSending = ref(false)
const commentComposer = ref<{ reset: () => void } | null>(null)

const moreSheetOpen = ref(false)
const tagSheetOpen = ref(false)
const tagDraft = ref('')
const tagList = ref<string[]>([])
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInput = ref<HTMLTextAreaElement | null>(null)
const editField = ref<EditField>(null)
const editDraft = ref('')
const assignableUsers = ref<TaskAssignee[]>([])
const failedAvatars = ref<Record<string, true>>({})

const canEdit = computed(() => hasPermission(auth.user, 'people.edit'))
const canDelete = computed(() => hasPermission(auth.user, 'people.delete'))

const displayName = computed(() => personName(person.value))

watch(
  displayName,
  (value) => {
    chrome.setAstraRecordName(value && value !== 'Person' ? value : null)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  chrome.setAstraRecordName(null)
})

const tags = computed(() => {
  const raw = person.value?.tags
  if (!Array.isArray(raw)) return []
  return raw.map((tag) => String(tag)).filter(Boolean)
})

const assignee = computed(() => parsePerson(person.value?.assignedTo))
const organization = computed(() => parseOrganization(person.value))
const phoneValue = computed(() => String(person.value?.phone || person.value?.mobile || '').trim())
const statusLabel = computed(() => {
  const derived = String(person.value?.derivedStatus || '').trim()
  if (derived) return formatToken(derived)
  const sales = String(person.value?.sales_type || '').trim()
  if (sales) return sales
  const helpdesk = String(person.value?.helpdesk_role || '').trim()
  return helpdesk ? formatToken(helpdesk) : ''
})

const keyFieldRows = computed(() => [
  { key: 'email', label: 'Email', value: String(person.value?.email || '').trim() },
  { key: 'phone', label: 'Phone', value: phoneValue.value },
  { key: 'jobTitle', label: 'Title', value: String(person.value?.job_title || '').trim() },
  { key: 'organization', label: 'Organization', value: organization.value?.name || '' },
  { key: 'assignee', label: 'Assignee', value: assignee.value?.name || '' },
  { key: 'status', label: 'Status', value: statusLabel.value }
])

const detailRows = computed(() => {
  const rows = [
    { key: 'source', label: 'Source', value: String(person.value?.source || '').trim() },
    { key: 'tags', label: 'Tags', value: tags.value.join(', ') },
    {
      key: 'createdAt',
      label: 'Created',
      value: formatDate(person.value?.createdAt)
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      value: formatDate(person.value?.updatedAt)
    },
    {
      key: 'lastActivity',
      label: 'Last activity',
      value: formatDate(person.value?.lastActivity)
    }
  ]
  return rows.filter((row) => row.value)
})

const editTitle = computed(() => {
  switch (editField.value) {
    case 'email':
      return 'Email'
    case 'phone':
      return 'Phone'
    case 'jobTitle':
      return 'Title'
    case 'assignee':
      return 'Assignee'
    case 'description':
      return 'Description'
    default:
      return 'Edit'
  }
})

type EditChoice = { value: string; label: string; avatar?: string; initials?: string }

const editChoices = computed((): EditChoice[] => {
  if (editField.value !== 'assignee') return []
  return assignableUsers.value.map((user) => {
    const parsed = parsePerson(user)
    return {
      value: String(user._id || ''),
      label: parsed?.name || user.email || 'User',
      avatar: parsed?.avatar || '',
      initials: parsed?.initials || initialsFor(user.email || 'U')
    }
  })
})

const activityItems = computed(() =>
  [...activityLogs.value]
    .map((log, index) => ({
      id: String(log._id || `log-${index}-${log.timestamp || index}`),
      at: Date.parse(String(log.timestamp || '')) || index,
      title: formatActivityLog(log),
      detail: formatActivityDetail(log)
    }))
    .sort((a, b) => a.at - b.at)
)

function personName(record: PeopleRecord | null | undefined): string {
  if (!record) return 'Person'
  const first = String(record.first_name || '').trim()
  const last = String(record.last_name || '').trim()
  const full = `${first} ${last}`.trim()
  return full || String(record.name || record.email || 'Person')
}

function parseOrganization(record: PeopleRecord | null | undefined) {
  if (!record?.organization) return null
  const org = record.organization
  if (typeof org === 'string') {
    const name = org.trim()
    return name ? { id: org, name } : null
  }
  const name = String(org.name || '').trim()
  const id = String(org._id || '').trim()
  if (!name && !id) return null
  return { id, name: name || 'Organization' }
}

function parsePerson(
  raw: PeopleAssignee | TaskAssignee | string | null | undefined
): { name: string; initials: string; avatar?: string } | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const name = raw.trim()
    return name ? { name, initials: initialsFor(name) } : null
  }
  const name =
    [raw.firstName || raw.first_name, raw.lastName || raw.last_name].filter(Boolean).join(' ').trim()
    || raw.email
    || ''
  if (!name) return null
  return { name, initials: initialsFor(name), avatar: resolveAvatarUrl(raw.avatar) }
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatToken(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
}

function formatDate(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelativeTime(value?: string | number): string {
  if (value === undefined || value === null || value === '') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hr ago' : `${hours} hrs ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return (
    date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
    ' at ' +
    date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  )
}

function avatarIsReady(src?: string): boolean {
  return Boolean(src) && !failedAvatars.value[src as string]
}

function onAvatarError(src?: string) {
  if (!src) return
  failedAvatars.value = { ...failedAvatars.value, [src]: true }
}

function formatActivityLog(log: PeopleActivityLog): string {
  const actor = String(log.user || 'Someone')
  const action = String(log.action || 'updated this person')
  if (action === 'created') return `${actor} created this person`
  if (/^note$/i.test(action) && log.details) return `${actor} added a note`
  return `${actor} ${action.replace(/_/g, ' ')}`
}

function formatActivityDetail(log: PeopleActivityLog): string {
  const details = log.details
  if (!details) return ''
  if (typeof details === 'string') return details
  const content = details.content ?? details.note ?? details.message
  if (typeof content === 'string' && content.trim()) return content.trim()
  const from = details.from ?? details.oldValue
  const to = details.to ?? details.newValue
  if (from != null || to != null) {
    return `Changed from '${String(from ?? 'empty')}' to '${String(to ?? 'empty')}'`
  }
  return ''
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchPerson(props.personId)
    person.value = res.data
    if (person.value) {
      await addRecent({
        id: props.personId,
        moduleKey: 'people',
        title: personName(person.value),
        path: `/modules/people/${props.personId}`
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load person'
  } finally {
    loading.value = false
  }
}

async function loadActivity() {
  if (activityLoaded.value || activityLoading.value) return
  activityLoading.value = true
  activityError.value = null
  try {
    const res = await fetchPersonActivityLogs(props.personId)
    activityLogs.value = Array.isArray(res.data) ? res.data : []
    activityLoaded.value = true
  } catch (err) {
    activityError.value = err instanceof Error ? err.message : 'Failed to load activity'
  } finally {
    activityLoading.value = false
  }
}

async function savePerson(payload: Record<string, unknown>) {
  if (!person.value || !canEdit.value) return
  saving.value = true
  error.value = null
  try {
    const res = await updatePerson(props.personId, payload)
    if (res.data) person.value = { ...person.value, ...res.data }
    void tapHaptic()
    editField.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not save changes'
    await load()
  } finally {
    saving.value = false
  }
}

function resizeTitleInput() {
  const el = titleInput.value
  if (!el) return
  el.style.height = '0px'
  el.style.height = `${el.scrollHeight}px`
}

async function startTitleEdit() {
  if (!canEdit.value) return
  titleDraft.value = displayName.value === 'Person' ? '' : displayName.value
  editingTitle.value = true
  await nextTick()
  resizeTitleInput()
  titleInput.value?.focus()
  titleInput.value?.select()
}

async function saveTitle() {
  if (!editingTitle.value) return
  editingTitle.value = false
  const next = titleDraft.value.trim()
  if (!next || next === displayName.value) return
  const parts = next.split(/\s+/).filter(Boolean)
  const first_name = parts[0] || ''
  const last_name = parts.slice(1).join(' ')
  await savePerson({ first_name, last_name })
}

async function openField(key: string) {
  if (!canEdit.value || !person.value) return
  if (key === 'email') {
    editDraft.value = String(person.value.email || '')
    editField.value = 'email'
    return
  }
  if (key === 'phone') {
    editDraft.value = phoneValue.value
    editField.value = 'phone'
    return
  }
  if (key === 'jobTitle') {
    editDraft.value = String(person.value.job_title || '')
    editField.value = 'jobTitle'
    return
  }
  if (key === 'description') {
    editDraft.value = htmlToPlainText(String(person.value.description || ''))
    editField.value = 'description'
    return
  }
  if (key === 'assignee') {
    const current = person.value.assignedTo
    editDraft.value =
      current && typeof current === 'object' ? String(current._id || '') : String(current || '')
    editField.value = 'assignee'
    if (!assignableUsers.value.length) {
      try {
        const res = await fetchAssignableUsers()
        assignableUsers.value = Array.isArray(res.data) ? res.data : []
      } catch {
        assignableUsers.value = []
      }
    }
  }
}

function closeEdit() {
  editField.value = null
}

function goBack() {
  if (window.history.length > 1) router.back()
  else void router.push({ name: 'people-list' })
}

function onHeaderEdit() {
  moreSheetOpen.value = false
  if (tab.value !== 'summary') tab.value = 'summary'
  void startTitleEdit()
}

function onHeaderTag() {
  tagList.value = [...tags.value]
  tagDraft.value = ''
  tagSheetOpen.value = true
}

function addTag() {
  const next = tagDraft.value.trim()
  if (!next || tagList.value.includes(next)) return
  tagList.value = [...tagList.value, next]
  tagDraft.value = ''
}

function removeTag(tag: string) {
  tagList.value = tagList.value.filter((item) => item !== tag)
}

async function saveTags() {
  await savePerson({ tags: tagList.value })
  tagSheetOpen.value = false
}

async function copyLink() {
  moreSheetOpen.value = false
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/modules/people/${props.personId}`)
    success.value = 'Link copied'
  } catch {
    error.value = 'Could not copy link'
  }
}

async function onDelete() {
  if (!canDelete.value) return
  moreSheetOpen.value = false
  if (!window.confirm('Delete this person?')) return
  try {
    await deletePerson(props.personId)
    void tapHaptic()
    await router.replace({ name: 'people-list' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not delete person'
  }
}

async function pickChoice(value: string) {
  if (!value) return
  if (editField.value === 'assignee') await savePerson({ assignedTo: value })
}

async function commitEdit() {
  if (editField.value === 'email') {
    await savePerson({ email: editDraft.value.trim() || null })
    return
  }
  if (editField.value === 'phone') {
    const value = editDraft.value.trim()
    await savePerson(value ? { phone: value } : { phone: null, mobile: null })
    return
  }
  if (editField.value === 'jobTitle') {
    await savePerson({ job_title: editDraft.value.trim() || null })
    return
  }
  if (editField.value === 'description') {
    const text = editDraft.value.trim()
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const html = escaped
      ? `<p>${escaped.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
      : ''
    await savePerson({ description: html })
  }
}

async function onSendNote(payload: { content: string }) {
  const text = payload.content.trim()
  if (!text || commentSending.value) return
  commentSending.value = true
  activityError.value = null
  try {
    const res = await addPersonActivityLog(props.personId, {
      user: auth.displayName,
      action: 'note',
      details: text
    })
    if (res.data) activityLogs.value = [...activityLogs.value, res.data]
    commentComposer.value?.reset()
    void tapHaptic()
  } catch (err) {
    activityError.value = err instanceof Error ? err.message : 'Failed to post note'
  } finally {
    commentSending.value = false
  }
}

watch(tab, (next) => {
  if (next === 'activity') void loadActivity()
})

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="record-drawer">
    <MobileRecordBar
      title="Person"
      :tabs="TABS"
      :active-tab="tab"
      :show-edit="canEdit"
      :show-tag="canEdit"
      :show-more="true"
      :has-tags="tags.length > 0"
      @back="goBack"
      @edit="onHeaderEdit"
      @tag="onHeaderTag"
      @more="moreSheetOpen = true"
      @update:active-tab="tab = $event as RecordTab"
    />
    <div class="record-drawer__body">
      <div class="record-page">
        <div v-if="error" class="banner banner-error">{{ error }}</div>
        <div v-if="success" class="banner banner-info">{{ success }}</div>
        <div v-if="loading" class="empty">Loading person…</div>

        <template v-else-if="person">
          <div class="panels">
            <div class="pane" :class="{ 'is-active': tab === 'summary' }">
              <div class="stack">
                <article class="hero hero--person">
                  <MobileAvatar :record="person" size="lg" />
                  <div class="hero__body">
                    <textarea
                      v-if="editingTitle"
                      ref="titleInput"
                      v-model="titleDraft"
                      class="hero__title-input"
                      rows="1"
                      maxlength="200"
                      aria-label="Person name"
                      @input="resizeTitleInput"
                      @blur="saveTitle"
                      @keydown.enter.prevent="saveTitle"
                      @keydown.escape="editingTitle = false"
                    />
                    <h1
                      v-else
                      :class="{ 'is-editable': canEdit }"
                      @click="startTitleEdit"
                    >
                      {{ displayName }}
                    </h1>
                  </div>
                </article>

                <section class="block">
                  <header class="block__head">
                    <h2>Key Fields</h2>
                  </header>
                  <MobileRecordFields
                    :rows="keyFieldRows"
                    :interactive="canEdit"
                    @edit="openField"
                  >
                    <template #email-icon><EnvelopeIcon /></template>
                    <template #phone-icon><PhoneIcon /></template>
                    <template #jobTitle-icon><BriefcaseIcon /></template>
                    <template #organization-icon><BuildingOffice2Icon /></template>
                    <template #assignee-icon><UserIcon /></template>
                    <template #status-icon><span class="field-status-ring" aria-hidden="true" /></template>
                    <template #email>
                      <a
                        v-if="person.email"
                        class="link"
                        :href="`mailto:${person.email}`"
                        @click.stop
                      >
                        {{ person.email }}
                      </a>
                      <span v-else class="muted">—</span>
                    </template>
                    <template #phone>
                      <a
                        v-if="phoneValue"
                        class="link"
                        :href="`tel:${phoneValue}`"
                        @click.stop
                      >
                        {{ phoneValue }}
                      </a>
                      <span v-else class="muted">—</span>
                    </template>
                    <template #jobTitle>
                      <span v-if="person.job_title">{{ person.job_title }}</span>
                      <span v-else class="muted">—</span>
                    </template>
                    <template #organization>
                      <RouterLink
                        v-if="organization?.id"
                        class="link"
                        :to="`/modules/organizations/${organization.id}`"
                        @click.stop
                      >
                        {{ organization.name }}
                      </RouterLink>
                      <span v-else class="muted">—</span>
                    </template>
                    <template #assignee>
                      <span v-if="assignee" class="person">
                        <img
                          v-if="avatarIsReady(assignee.avatar)"
                          class="person__avatar"
                          :src="assignee.avatar"
                          alt=""
                          @error="onAvatarError(assignee.avatar)"
                        />
                        <span v-else class="person__initials">{{ assignee.initials }}</span>
                        {{ assignee.name }}
                      </span>
                      <span v-else class="muted">Unassigned</span>
                    </template>
                    <template #status>
                      <span v-if="statusLabel">{{ statusLabel }}</span>
                      <span v-else class="muted">—</span>
                    </template>
                  </MobileRecordFields>
                </section>

                <section class="block">
                  <header class="block__head">
                    <h2>Description</h2>
                  </header>
                  <button
                    v-if="canEdit"
                    type="button"
                    class="edit-surface"
                    @click="openField('description')"
                  >
                    <MobileRichHtml :html="person.description" empty-text="Tap to add a description" />
                  </button>
                  <MobileRichHtml v-else :html="person.description" empty-text="No description yet." />
                </section>

                <section v-if="detailRows.length" class="block">
                  <header class="block__head">
                    <h2>Details</h2>
                  </header>
                  <MobileRecordFields :rows="detailRows">
                    <template #source-icon><LinkIcon /></template>
                    <template #tags-icon><TagIcon /></template>
                    <template #createdAt-icon><CalendarDaysIcon /></template>
                    <template #updatedAt-icon><CalendarDaysIcon /></template>
                    <template #lastActivity-icon><CalendarDaysIcon /></template>
                    <template #tags>
                      <div v-if="tags.length" class="tag-row">
                        <span v-for="tag in tags" :key="tag" class="pill">{{ tag }}</span>
                      </div>
                      <span v-else class="muted">—</span>
                    </template>
                  </MobileRecordFields>
                </section>

                <section class="block">
                  <header class="block__head">
                    <h2>Related</h2>
                  </header>
                  <div v-if="organization?.id" class="rows">
                    <RouterLink
                      class="row"
                      :to="`/modules/organizations/${organization.id}`"
                    >
                      <span class="row__icon">
                        <ModuleIcon module-key="organizations" :size="16" />
                      </span>
                      <span class="row__copy">
                        <span class="row__title">{{ organization.name }}</span>
                        <span class="row__meta">Organization</span>
                      </span>
                      <ArrowRightIcon class="row__arrow" />
                    </RouterLink>
                  </div>
                  <div v-else class="blank">
                    <LinkIcon class="blank__icon" />
                    <p class="blank__title">Nothing linked</p>
                    <p class="blank__hint">Organizations and related records show up here.</p>
                  </div>
                </section>
              </div>
            </div>

            <div class="pane pane--activity" :class="{ 'is-active': tab === 'activity' }">
              <div class="activity">
                <div v-if="activityError" class="banner banner-error">{{ activityError }}</div>
                <div v-if="activityLoading" class="blank">
                  <p class="blank__hint">Loading activity…</p>
                </div>
                <div v-else-if="activityItems.length" class="activity__feed">
                  <div v-for="item in activityItems" :key="item.id" class="system-row">
                    <span class="system-row__dot" />
                    <div class="system-row__copy">
                      <p class="system-row__title">
                        {{ item.title }}
                        <span class="system-row__time">{{ formatRelativeTime(item.at) }}</span>
                      </p>
                      <p v-if="item.detail" class="system-row__detail">{{ item.detail }}</p>
                    </div>
                  </div>
                </div>
                <div v-else class="blank">
                  <p class="blank__title">No activity yet</p>
                  <p class="blank__hint">Notes and updates will show up here.</p>
                </div>

                <div class="activity__dock">
                  <MobileCommentComposer
                    ref="commentComposer"
                    :users="[]"
                    :sending="commentSending"
                    placeholder="Write a note…"
                    :resolve-avatar="resolveAvatarUrl"
                    :initials-for="initialsFor"
                    @send="onSendNote"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <MobileBottomSheet
      :open="Boolean(editField)"
      :title="editTitle"
      :tall="editField === 'description' || editField === 'assignee'"
      @close="closeEdit"
    >
      <div v-if="editChoices.length" class="choices">
        <button
          v-for="choice in editChoices"
          :key="choice.value"
          type="button"
          class="choice"
          :class="{ 'is-selected': editDraft === choice.value }"
          :disabled="saving"
          @click="pickChoice(choice.value)"
        >
          <img
            v-if="avatarIsReady(choice.avatar)"
            class="person__avatar"
            :src="choice.avatar"
            alt=""
            @error="onAvatarError(choice.avatar)"
          />
          <span v-else class="person__initials">{{ choice.initials }}</span>
          <span class="choice__label">{{ choice.label }}</span>
          <CheckIcon v-if="editDraft === choice.value" class="choice__check" />
        </button>
      </div>
      <div v-else-if="editField === 'description'" class="notes">
        <textarea
          v-model="editDraft"
          class="notes__input"
          placeholder="Write a description…"
          enterkeyhint="enter"
        />
        <button class="notes__done" type="button" :disabled="saving" @click="commitEdit">
          {{ saving ? 'Saving…' : 'Done' }}
        </button>
      </div>
      <form v-else class="edit-form" @submit.prevent="commitEdit">
        <input
          v-if="editField === 'email'"
          v-model="editDraft"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="Email"
        />
        <input
          v-else-if="editField === 'phone'"
          v-model="editDraft"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          placeholder="Phone"
        />
        <input
          v-else-if="editField === 'jobTitle'"
          v-model="editDraft"
          type="text"
          placeholder="Job title"
        />
        <div class="edit-form__actions">
          <button class="btn" type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </MobileBottomSheet>

    <MobileBottomSheet :open="tagSheetOpen" title="Tags" @close="tagSheetOpen = false">
      <form class="edit-form" @submit.prevent="addTag">
        <div class="tag-row">
          <button
            v-for="tag in tagList"
            :key="tag"
            type="button"
            class="pill"
            @click="removeTag(tag)"
          >
            {{ tag }} ×
          </button>
        </div>
        <input v-model="tagDraft" type="text" maxlength="40" placeholder="Add a tag" />
        <div class="edit-form__actions">
          <button class="btn btn-ghost" type="submit">Add</button>
          <button class="btn" type="button" :disabled="saving" @click="saveTags">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </MobileBottomSheet>

    <MobileBottomSheet :open="moreSheetOpen" title="More" @close="moreSheetOpen = false">
      <div class="choices">
        <button type="button" class="choice" @click="copyLink">Copy link</button>
        <button
          v-if="canDelete"
          type="button"
          class="choice choice--danger"
          @click="onDelete"
        >
          Delete person
        </button>
      </div>
    </MobileBottomSheet>
  </section>
</template>

<style scoped>
.record-drawer__body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.record-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0;
}

.panels {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.pane {
  position: absolute;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(-8px, 0, 0);
  transition:
    opacity 160ms ease,
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.pane.is-active {
  opacity: 1;
  pointer-events: auto;
  transform: translate3d(0, 0, 0);
  z-index: 1;
}

.pane--activity {
  transform: translate3d(8px, 0, 0);
  background: #f3f4f6;
}

.pane--activity.is-active {
  transform: translate3d(0, 0, 0);
}

.stack {
  display: grid;
  gap: 0;
  padding: 0.7rem 1.2rem 1.5rem;
}

.block {
  padding: 1.1rem 0 1.2rem;
  border-top: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
}

.block__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0 0 0.7rem;
}

.block__head h2 {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hero {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.35rem 0 1.15rem;
}

.hero__body {
  min-width: 0;
  flex: 1;
}

.hero h1 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.03em;
}

.hero h1.is-editable {
  cursor: pointer;
}

.hero__title-input {
  display: block;
  width: 100%;
  margin: 0;
  border: none;
  padding: 0;
  resize: none;
  overflow: hidden;
  field-sizing: content;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.03em;
}

.edit-surface {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
}

.link {
  color: var(--accent-strong);
  text-decoration: none;
  word-break: break-word;
}

.person {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.person__avatar,
.person__initials {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
}

.person__initials {
  display: grid;
  place-items: center;
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent) 16%, white);
}

.pill {
  display: inline-flex;
  align-items: center;
  border-radius: 0.5rem;
  padding: 0.18rem 0.45rem;
  font-size: 0.6875rem;
  font-weight: 600;
  background: var(--bg-soft);
  color: var(--text-muted);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.rows {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0;
  color: inherit;
  text-decoration: none;
}

.row__icon {
  display: flex;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.row__copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.1rem;
}

.row__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
}

.row__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.row__arrow {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--border);
}

.blank {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.15rem 0 0.35rem;
}

.blank__icon {
  width: 1.5rem;
  height: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-muted);
}

.blank__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
}

.blank__hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.activity {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: #f3f4f6;
}

.activity__feed {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  padding: 0.85rem 1rem 0.4rem;
}

.activity__dock {
  padding: 0 0.85rem;
  background: #f3f4f6;
}

.system-row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.15rem 0.2rem;
}

.system-row__dot {
  width: 0.35rem;
  height: 0.35rem;
  margin-top: 0.45rem;
  border-radius: 999px;
  background: #94a3b8;
  flex-shrink: 0;
}

.system-row__copy {
  min-width: 0;
  flex: 1;
}

.system-row__title {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #64748b;
}

.system-row__time {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 0.72rem;
}

.system-row__detail {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #334155;
}

.choices {
  display: grid;
  gap: 0.35rem;
  padding-bottom: 0.5rem;
}

.choice {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  border: none;
  border-radius: 0.5rem;
  padding: 0.72rem 0.4rem;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1rem;
  text-align: left;
}

.choice.is-selected {
  font-weight: 500;
}

.choice--danger {
  color: var(--danger);
}

.choice__label {
  min-width: 0;
  flex: 1;
}

.choice__check {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  color: var(--accent-strong);
}

.notes {
  display: flex;
  flex-direction: column;
  min-height: 18rem;
  gap: 0.85rem;
}

.notes__input {
  display: block;
  flex: 1;
  width: 100%;
  min-height: 16rem;
  margin: 0;
  padding: 0.1rem 0.05rem;
  border: none;
  resize: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1.0625rem;
  line-height: 1.5;
  outline: none;
}

.notes__done {
  align-self: flex-end;
  border: none;
  border-radius: 0.75rem;
  padding: 0.7rem 1.15rem;
  background: var(--accent-strong);
  color: #fff;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
}

.edit-form {
  display: grid;
  gap: 0.75rem;
  padding-bottom: 0.35rem;
}

.edit-form input {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.8rem 0.9rem;
}

.edit-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .pane {
    transition: none;
  }
}
</style>
