<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { CalendarRange, Inbox, AlertTriangle, RefreshCw, Loader2, Search, X, Gauge } from 'lucide-vue-next'
import { useSprintStore } from '../stores/sprint'
import { STATUSES, DEFAULT_STATUS } from '../lib/constants'
import { formatDuration } from '../lib/gitlab'
import { fuzzyMatch } from '../lib/text'
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

// ---- Capacity --------------------------------------------------------------
// Rough sprint capacity = working days × focused hours/day. Lets us flag a
// sprint that is planned beyond what the timeframe realistically allows.
const HOURS_PER_DAY = 7
const workingDays = computed(
  () => store.sprintDays.filter((d) => d.day() !== 0 && d.day() !== 6).length
)
const capacityHours = computed(() => workingDays.value * HOURS_PER_DAY)
const estimateHours = computed(() => store.totalEstimateSeconds / 3600)
const capacityPct = computed(() =>
  capacityHours.value ? Math.round((estimateHours.value / capacityHours.value) * 100) : 0
)
const overCapacity = computed(
  () => capacityHours.value > 0 && estimateHours.value > capacityHours.value
)

// ---- "Non estimé" ----------------------------------------------------------
const unestimatedCount = computed(
  () => store.issues.filter((i) => !(i.time_stats?.time_estimate > 0)).length
)

// ---- Filters ---------------------------------------------------------------
const filters = ref({ q: '', assignee: '', label: '', unestimatedOnly: false })
const hasFilters = computed(
  () =>
    !!filters.value.q ||
    !!filters.value.assignee ||
    !!filters.value.label ||
    filters.value.unestimatedOnly
)
function clearFilters() {
  filters.value = { q: '', assignee: '', label: '', unestimatedOnly: false }
}

const assigneeOf = (i) => i.assignees?.[0] || i.assignee || null

const assigneeOptions = computed(() => {
  const map = new Map()
  store.issues.forEach((i) => {
    const a = assigneeOf(i)
    if (a) map.set(a.username || a.name, a.name || a.username)
  })
  return [...map.entries()].map(([value, label]) => ({ value, label }))
})

const labelOptions = computed(() => {
  const set = new Set()
  store.issues.forEach((i) => (i.labels || []).forEach((l) => set.add(l)))
  return [...set].sort((a, b) => a.localeCompare(b))
})

function matchesFilters(i) {
  const f = filters.value
  if (f.q) {
    const num = f.q.replace(/[^0-9]/g, '')
    const byText = fuzzyMatch(i.title, f.q)
    const byNum = num && String(i.iid).includes(num)
    if (!byText && !byNum) return false
  }
  if (f.assignee) {
    const a = assigneeOf(i)
    if (!a || (a.username || a.name) !== f.assignee) return false
  }
  if (f.label && !(i.labels || []).includes(f.label)) return false
  if (f.unestimatedOnly && i.time_stats?.time_estimate > 0) return false
  return true
}

// Same grouping as the store getter, but with the active filters applied.
const filteredByStatus = computed(() => {
  const groups = {}
  STATUSES.forEach((s) => (groups[s.key] = []))
  store.issues.filter(matchesFilters).forEach((issue) => {
    const key = store.statusFor(issue.iid)
    ;(groups[key] || groups[DEFAULT_STATUS]).push(issue)
  })
  return groups
})

const visibleCount = computed(() =>
  Object.values(filteredByStatus.value).reduce((s, a) => s + a.length, 0)
)

function showUnestimated() {
  clearFilters()
  filters.value.unestimatedOnly = true
}

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
          <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-brand-100">
            <CalendarRange class="h-4 w-4" />
            <span>{{ range }}</span>
            <button
              v-if="unestimatedCount"
              type="button"
              class="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-300"
              title="Filtrer les tickets sans estimation GitLab"
              @click="showUnestimated"
            >
              {{ unestimatedCount }} non estimé{{ unestimatedCount > 1 ? 's' : '' }}
            </button>
          </div>
        </div>
        <div class="flex flex-wrap gap-3">
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

      <!-- Capacity -->
      <div v-if="capacityHours" class="mt-5">
        <div class="mb-1.5 flex items-center justify-between text-xs text-brand-100">
          <span class="inline-flex items-center gap-1.5">
            <Gauge class="h-3.5 w-3.5" />
            Charge planifiée
            <span v-if="overCapacity" class="inline-flex items-center gap-1 font-semibold text-amber-200">
              <AlertTriangle class="h-3.5 w-3.5" /> surchargé
            </span>
          </span>
          <span class="font-semibold tabular-nums">
            {{ Math.round(estimateHours) }}h / {{ capacityHours }}h ({{ capacityPct }}%)
          </span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="overCapacity ? 'bg-amber-300' : 'bg-white/80'"
            :style="{ width: `${Math.min(100, capacityPct)}%` }"
          />
        </div>
        <p v-if="overCapacity" class="mt-1.5 text-xs text-amber-100">
          L'estimation cumulée dépasse la capacité du sprint ({{ workingDays }} j × {{ HOURS_PER_DAY }} h).
        </p>
      </div>
    </div>

    <!-- Error / retry -->
    <div
      v-if="store.issuesError && !store.loading.issues"
      class="flex flex-wrap items-center gap-3 rounded-2xl bg-rose-50 p-5 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"
    >
      <AlertTriangle class="h-5 w-5 shrink-0" />
      <div class="flex-1">
        <div class="font-semibold">Impossible de charger les tickets de ce sprint.</div>
        <div class="text-rose-600/80">{{ store.issuesError }}</div>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
        @click="store.retrySprint()"
      >
        <RefreshCw class="h-4 w-4" /> Réessayer
      </button>
    </div>

    <!-- Loading -->
    <div
      v-else-if="store.loading.issues"
      class="flex items-center justify-center gap-2 rounded-2xl bg-white py-16 text-sm text-slate-400 shadow-card"
    >
      <Loader2 class="h-5 w-5 animate-spin" /> Chargement des tickets…
    </div>

    <template v-else>
      <!-- Distribution -->
      <div class="rounded-2xl bg-white p-6 shadow-card">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Répartition par statut
        </h3>
        <DistributionBar :distribution="store.distribution" />
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex-none sm:basis-72">
          <Search class="h-4 w-4 shrink-0 text-slate-400" />
          <input
            v-model="filters.q"
            type="text"
            placeholder="Rechercher un ticket (#id ou titre)…"
            class="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
        <select
          v-model="filters.assignee"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-400"
        >
          <option value="">Tous les assignés</option>
          <option v-for="a in assigneeOptions" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
        <select
          v-model="filters.label"
          class="max-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-400"
        >
          <option value="">Tous les labels</option>
          <option v-for="l in labelOptions" :key="l" :value="l">{{ l }}</option>
        </select>
        <label class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
          <input v-model="filters.unestimatedOnly" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
          Non estimés
        </label>
        <button
          v-if="hasFilters"
          class="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          @click="clearFilters"
        >
          <X class="h-4 w-4" /> Réinitialiser
          <span class="text-xs text-slate-400">({{ visibleCount }}/{{ store.issues.length }})</span>
        </button>
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
              {{ filteredByStatus[col.key].length }}
            </span>
          </div>

          <div class="flex flex-1 flex-col gap-2.5">
            <div
              v-for="issue in filteredByStatus[col.key]"
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
              v-if="!filteredByStatus[col.key].length"
              class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400"
            >
              <Inbox class="mb-1 h-5 w-5" />
              {{ hasFilters ? 'Aucun ticket' : 'Déposer un ticket ici' }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
