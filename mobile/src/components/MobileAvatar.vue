<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveAvatarUrl } from '@/utils/avatarUrl'

type AvatarRecord = {
  first_name?: string
  firstName?: string
  lastName?: string
  last_name?: string
  name?: string
  email?: string
  username?: string
  initials?: string
  avatar?: string | null
  image?: string | null
}

const props = withDefaults(
  defineProps<{
    record?: AvatarRecord | null
    user?: AvatarRecord | null
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' }
)

const imageBroken = ref(false)

const recordObj = computed(() => props.user || props.record || null)

const avatarSrc = computed(() => {
  const raw = recordObj.value?.avatar || recordObj.value?.image
  const resolved = resolveAvatarUrl(typeof raw === 'string' ? raw : '')
  return resolved || ''
})

const displayInitials = computed(() => {
  const record = recordObj.value
  if (!record) return '?'

  if (record.initials) return String(record.initials).trim().toUpperCase()

  const first = String(record.firstName || record.first_name || '').trim()
  const last = String(record.lastName || record.last_name || '').trim()
  if (first && last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  if (first.length >= 2) return first.slice(0, 2).toUpperCase()
  if (first) return first.charAt(0).toUpperCase()
  if (last.length >= 2) return last.slice(0, 2).toUpperCase()
  if (last) return last.charAt(0).toUpperCase()

  const full = String(record.name || '').trim()
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase()
    return parts[0].charAt(0).toUpperCase()
  }

  const email = String(record.email || '').trim()
  if (email) {
    const local = email.split('@')[0] || ''
    const parts = local.replace(/[._+-]/g, ' ').split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
    if (local.length >= 2) return local.slice(0, 2).toUpperCase()
    if (local) return local.charAt(0).toUpperCase()
  }

  if (record.username) return String(record.username).trim().slice(0, 2).toUpperCase()
  return '?'
})

const toneClass = computed(() => {
  const letter = displayInitials.value.charAt(0).toUpperCase()
  if (!letter || letter === '?') return 'mobile-avatar--tone-z'
  const code = letter.charCodeAt(0)
  if (code < 65 || code > 90) return 'mobile-avatar--tone-z'
  return `mobile-avatar--tone-${letter.toLowerCase()}`
})

const showImage = computed(() => Boolean(avatarSrc.value) && !imageBroken.value)

watch(avatarSrc, () => {
  imageBroken.value = false
})
</script>

<template>
  <span class="mobile-avatar" :class="[`mobile-avatar--${size}`, toneClass]" aria-hidden="true">
    <img
      v-if="showImage"
      class="mobile-avatar__image"
      :src="avatarSrc"
      alt=""
      @error="imageBroken = true"
    />
    <span v-else class="mobile-avatar__initials">{{ displayInitials }}</span>
  </span>
</template>

<style scoped>
.mobile-avatar {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 0.5rem;
  font-weight: 700;
  line-height: 1;
}

.mobile-avatar--sm {
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.62rem;
}

.mobile-avatar--md {
  width: 2.25rem;
  height: 2.25rem;
  font-size: 0.72rem;
}

.mobile-avatar--lg {
  width: 2.75rem;
  height: 2.75rem;
  font-size: 0.82rem;
}

.mobile-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-avatar__initials {
  user-select: none;
}

.mobile-avatar--tone-a { background: #fee2e2; color: #b91c1c; }
.mobile-avatar--tone-b { background: #ffedd5; color: #c2410c; }
.mobile-avatar--tone-c { background: #fef3c7; color: #b45309; }
.mobile-avatar--tone-d { background: #fef9c3; color: #a16207; }
.mobile-avatar--tone-e { background: #ecfccb; color: #4d7c0f; }
.mobile-avatar--tone-f { background: #dcfce7; color: #15803d; }
.mobile-avatar--tone-g { background: #d1fae5; color: #047857; }
.mobile-avatar--tone-h { background: #ccfbf1; color: #0f766e; }
.mobile-avatar--tone-i { background: #cffafe; color: #0e7490; }
.mobile-avatar--tone-j { background: #e0f2fe; color: #0369a1; }
.mobile-avatar--tone-k { background: #dbeafe; color: #1d4ed8; }
.mobile-avatar--tone-l { background: #e0e7ff; color: #4338ca; }
.mobile-avatar--tone-m { background: #ede9fe; color: #6d28d9; }
.mobile-avatar--tone-n { background: #f3e8ff; color: #7e22ce; }
.mobile-avatar--tone-o { background: #fae8ff; color: #a21caf; }
.mobile-avatar--tone-p { background: #fce7f3; color: #be185d; }
.mobile-avatar--tone-q { background: #ffe4e6; color: #be123c; }
.mobile-avatar--tone-r { background: #fee2e2; color: #991b1b; }
.mobile-avatar--tone-s { background: #ffedd5; color: #9a3412; }
.mobile-avatar--tone-t { background: #fef3c7; color: #92400e; }
.mobile-avatar--tone-u { background: #fef9c3; color: #854d0e; }
.mobile-avatar--tone-v { background: #ecfccb; color: #3f6212; }
.mobile-avatar--tone-w { background: #dcfce7; color: #166534; }
.mobile-avatar--tone-x { background: #d1fae5; color: #065f46; }
.mobile-avatar--tone-y { background: #ccfbf1; color: #115e59; }
.mobile-avatar--tone-z { background: #f3f4f6; color: #6b7280; }
</style>
