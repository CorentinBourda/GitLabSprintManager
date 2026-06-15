<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { CalendarRange, Inbox } from 'lucide-vue-next'
import { useSprintStore } from '../stores/sprint'
import { STATUSES } from '../lib/constants'
import { formatDuration } from '../lib/gitlab'
import DistributionBar from './DistributionBar.vue'
import TicketCard from './TicketCard.vue'

const store = useSprintStore()
const dragOverColumn = ref(null)

const milestone = computed(() => store.currentMilestone)

const range = computed(() => {
  if (!milestone.value) return ''
  const s = store.sprintStart.format('D MMM')
  const e = store.sprintEnd.format('D MMM YYYY')
  return `${s} → ${e}`
})

const daysLeft = computed(() => {
  if (!milestone.value?.due_date) return null
  return store.sprintEnd.startOf('day').diff(dayjs().startOf('day'), 'day')
})

function onDrop(statusKey, e) {
  dragOverColumn.value = null
  try {
    const payload = JSON.parse(e.dataTransfer.getData('application/json'))
    if (payload.type !== 'board-issue') return
    const issue = store.issues.find((i) => i.iid === payload.issue_iid)
    if (issue) store.setStatus(issue, statusKey)
  } catch (_) {}
}

function onDragStart(issue, e) {
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData(
    'application/json',
    JSON.stringify({ type: 'board-issue', issue_iid: issue.iid })
  )
}
</script>

<template>
  <div v-if="!milestone" class="flex flex-col items-center justify-center py-24 text-center">
    <div class="rounded-2xl bg-white p-8 shadow-card">
      <CalendarRange class="mx-auto h-10 w-10 text-slate-300" />
      <h3 class="mt-3 text-lg font-semibold text-slate-700">Aucun sprint sélectionné</h3>
      <p class="mt-1 max-w-sm text-sm text-slate-500">
        Choisis un projet et un milestone dans la barre du haut pour afficher la
        répartition des tickets.
      </p>
    </div>
  </div>

  <div v-else class="space-y-6">
    <!-- Header -->
    <div class="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-glow">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-brand-200">Sprint en cours</div>
          <h2 class="mt-1 text-2xl font-bold">{{ milestone.title }}</h2>
          <div class="mt-2 flex items-center gap-2 text-sm text-brand-100">
            <CalendarRange class="h-4 w-4" />
            <span>{{ range }}</span>
          </div>
        </div>
        <div class="flex gap-3">
          <div class="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur">
            <div class="text-2xl font-bold tabular-nums">{{ store.issues.length }}</div>
            <div class="text-xs text-brand-100">tickets</div>
          </div>
          <div
            class="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur"
            :title="`Total estimé : ${formatDuration(store.totalEstimateSeconds)}`"
          >
            <div class="text-2xl font-bold tabular-nums">{{ formatDuration(store.remainingEstimateSeconds) }}</div>
            <div class="text-xs text-brand-100">temps estimé restant</div>
          </div>
          <div v-if="daysLeft !== null" class="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur">
            <div class="text-2xl font-bold tabular-nums">{{ daysLeft > 0 ? daysLeft : 'Terminé' }}</div>
            <div class="text-xs text-brand-100">{{ daysLeft > 0 ? 'jours restants' : 'sprint clos' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Distribution -->
    <div class="rounded-2xl bg-white p-6 shadow-card">
      <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Répartition des marqueurs
      </h3>
      <DistributionBar :distribution="store.distribution" />
    </div>

    <!-- Board -->
    <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-slim">
      <div
        v-for="col in STATUSES"
        :key="col.key"
        class="flex w-72 shrink-0 flex-col rounded-2xl p-3 transition"
        :class="[col.soft, dragOverColumn === col.key ? 'ring-2 ring-inset ' + col.ring : 'ring-1 ring-inset ring-slate-100']"
        @dragover.prevent="dragOverColumn = col.key"
        @dragleave="dragOverColumn === col.key && (dragOverColumn = null)"
        @drop="onDrop(col.key, $event)"
      >
        <div class="mb-3 flex items-center justify-between px-1">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :class="col.dot" />
            <span class="text-sm font-semibold text-slate-700">{{ col.label }}</span>
          </div>
          <span class="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm">
            {{ store.issuesByStatus[col.key].length }}
          </span>
        </div>

        <div class="flex flex-1 flex-col gap-2.5">
          <div
            v-for="issue in store.issuesByStatus[col.key]"
            :key="issue.iid"
            draggable="true"
            @dragstart="onDragStart(issue, $event)"
          >
            <TicketCard
              :issue="issue"
              :status="col.key"
              :scheduled-count="(store.ticketEventsByIssue[issue.iid] || []).length"
              :merge-requests="store.mergeRequestsFor(issue.iid)"
              @update:status="(v) => store.setStatus(issue, v)"
            />
          </div>

          <div
            v-if="!store.issuesByStatus[col.key].length"
            class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400"
          >
            <Inbox class="mb-1 h-5 w-5" />
            Déposer un ticket ici
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
