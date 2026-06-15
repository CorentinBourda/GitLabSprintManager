<script setup>
import { computed, ref, watch } from 'vue'
import { ExternalLink, GripVertical, CalendarClock, GitMerge } from 'lucide-vue-next'
import { statusMeta } from '../lib/constants'
import { avatarSrc, initials } from '../lib/gitlab'
import { useSprintStore } from '../stores/sprint'
import StatusPicker from './StatusPicker.vue'

const props = defineProps({
  issue: { type: Object, required: true },
  status: { type: String, default: 'not_started' },
  draggable: { type: Boolean, default: false },
  scheduledCount: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
  mergeRequests: { type: Array, default: () => [] },
  // When set, the left accent uses the project color instead of the status one.
  projectColor: { type: String, default: '' },
})
const emit = defineEmits(['update:status', 'dragstart'])

const store = useSprintStore()
const meta = computed(() => statusMeta(props.status))

// The "associated" MR: prefer an open one, then a merged one, else the first.
const primaryMr = computed(() => {
  const mrs = props.mergeRequests
  return (
    mrs.find((m) => m.state === 'opened') ||
    mrs.find((m) => m.state === 'merged') ||
    mrs[0] ||
    null
  )
})
const assignee = computed(() => props.issue.assignees?.[0] || props.issue.assignee || null)
const avatarUrl = computed(() => avatarSrc(assignee.value?.avatar_url, store.settings.base_url))
const avatarFailed = ref(false)
watch(avatarUrl, () => (avatarFailed.value = false))

function onDragStart(e) {
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData(
    'application/json',
    JSON.stringify({
      type: 'issue',
      issue_iid: props.issue.iid,
      title: props.issue.title,
      web_url: props.issue.web_url,
      project_id: props.issue.project_id,
    })
  )
  emit('dragstart', props.issue)
}
</script>

<template>
  <div
    class="group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
    :class="[`border-l-[3px]`, projectColor ? '' : meta.accent, draggable ? 'cursor-grab active:cursor-grabbing' : '']"
    :style="projectColor ? { borderLeftColor: projectColor } : {}"
    :draggable="draggable"
    @dragstart="onDragStart"
  >
    <div class="flex items-start gap-2">
      <GripVertical
        v-if="draggable"
        class="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <a
            :href="issue.web_url"
            target="_blank"
            rel="noopener"
            draggable="false"
            class="inline-flex items-center gap-0.5 transition hover:text-brand-600"
            :title="`Ouvrir #${issue.iid} dans GitLab`"
            @click.stop
            @mousedown.stop
          >
            #{{ issue.iid }}
            <ExternalLink class="h-3 w-3" />
          </a>
          <span v-if="scheduledCount" class="inline-flex items-center gap-1 text-brand-500">
            <CalendarClock class="h-3 w-3" /> {{ scheduledCount }}
          </span>
        </div>
        <p
          class="mt-0.5 line-clamp-2 cursor-help text-sm font-medium leading-snug text-slate-800"
          :title="issue.title"
        >
          {{ issue.title }}
        </p>

        <div v-if="!compact && issue.labels?.length" class="mt-2 flex flex-wrap gap-1">
          <span
            v-for="label in issue.labels.slice(0, 4)"
            :key="label"
            class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
          >
            {{ label }}
          </span>
        </div>
      </div>

      <div v-if="assignee" class="shrink-0" :title="assignee.name">
        <img
          v-if="avatarUrl && !avatarFailed"
          :src="avatarUrl"
          class="h-6 w-6 rounded-full object-cover ring-2 ring-white"
          @error="avatarFailed = true"
        />
        <span
          v-else
          class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 ring-2 ring-white"
        >
          {{ initials(assignee.name) }}
        </span>
      </div>
    </div>

    <div v-if="!compact" class="mt-3 flex items-center justify-between">
      <StatusPicker
        :model-value="status"
        @update:model-value="(v) => emit('update:status', v)"
      />
      <div class="flex items-center gap-2">
        <a
          v-if="primaryMr"
          :href="primaryMr.web_url"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-0.5 text-slate-400 transition hover:text-emerald-600"
          :title="`Voir la MR !${primaryMr.iid} — ${primaryMr.title}${mergeRequests.length > 1 ? ` (+${mergeRequests.length - 1} autres)` : ''}`"
        >
          <GitMerge class="h-4 w-4" />
          <span v-if="mergeRequests.length > 1" class="text-[10px] font-semibold">{{ mergeRequests.length }}</span>
        </a>
        <a
          :href="issue.web_url"
          target="_blank"
          rel="noopener"
          class="text-slate-300 transition hover:text-brand-600"
          title="Ouvrir le ticket dans GitLab"
        >
          <ExternalLink class="h-4 w-4" />
        </a>
      </div>
    </div>
  </div>
</template>
