<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { CalendarRange, Plus, Layers, Info } from 'lucide-vue-next'
import { useSprintStore } from '../stores/sprint'
import { statusMeta, DAY_START_HOUR, DAY_END_HOUR, HOUR_HEIGHT, EVENT_KINDS } from '../lib/constants'
import TicketCard from './TicketCard.vue'
import EventModal from './EventModal.vue'

const store = useSprintStore()

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i)
const gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT

const modalOpen = ref(false)
const editingEvent = ref(null)
const dragOverKey = ref(null)

const days = computed(() => store.sprintDays)
const hasMilestone = computed(() => !!store.currentMilestone)

// All-day lane height kept uniform across columns so the hour grids stay aligned.
const allDayLaneHeight = computed(() => {
  const max = days.value.reduce((m, d) => Math.max(m, allDayEvents(d).length), 0)
  return Math.max(40, max * 28 + 10)
})

// True when the event's [start, end] interval overlaps the given day at all,
// so multi-day events show up on every day they span (not just the start day).
function overlapsDay(e, day) {
  const start = day.startOf('day')
  const end = day.endOf('day')
  return dayjs(e.starts_at).isBefore(end) && dayjs(e.ends_at).isAfter(start)
}

function dayEvents(day) {
  return store.events.filter((e) => !e.all_day && overlapsDay(e, day))
}

function allDayEvents(day) {
  return store.events.filter((e) => e.all_day && overlapsDay(e, day))
}

// Greedy column packing for overlapping timed events.
function layout(events) {
  const sorted = [...events].sort((a, b) => +dayjs(a.starts_at) - +dayjs(b.starts_at))
  const colEnds = []
  const placed = sorted.map((e) => {
    const s = +dayjs(e.starts_at)
    const end = +dayjs(e.ends_at)
    let col = colEnds.findIndex((c) => c <= s)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(end)
    } else {
      colEnds[col] = end
    }
    return { e, col }
  })
  const total = Math.max(1, colEnds.length)
  return placed.map((p) => ({ ...p, total }))
}

function eventStyle(e, total, col, day) {
  const s = dayjs(e.starts_at)
  const en = dayjs(e.ends_at)
  // Clamp the event to the visible window of *this* day so a multi-day block
  // fills from the top (if it started earlier) or to the bottom (if it ends later).
  const startsBefore = s.isBefore(day.startOf('day'))
  const endsAfter = en.isAfter(day.endOf('day'))
  let startFloat = startsBefore ? DAY_START_HOUR : s.hour() + s.minute() / 60
  let endFloat = endsAfter ? DAY_END_HOUR : en.hour() + en.minute() / 60
  startFloat = Math.max(DAY_START_HOUR, Math.min(startFloat, DAY_END_HOUR))
  endFloat = Math.max(DAY_START_HOUR, Math.min(endFloat, DAY_END_HOUR))
  const top = Math.max(0, (startFloat - DAY_START_HOUR) * HOUR_HEIGHT)
  const height = Math.max(22, (endFloat - startFloat) * HOUR_HEIGHT - 2)
  const widthPct = 100 / total
  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `calc(${col * widthPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  }
}

function issueFor(e) {
  return store.issues.find((i) => i.iid === e.issue_iid)
}

function eventLabel(e) {
  if (e.kind === 'ticket') {
    const issue = issueFor(e)
    return issue ? `#${e.issue_iid} ${issue.title}` : e.title
  }
  return e.title
}

function eventVisual(e) {
  if (e.kind === 'ticket') {
    const issue = issueFor(e)
    const meta = statusMeta(issue ? store.statusFor(issue.iid) : 'not_started')
    return { soft: true, classes: `${meta.soft} ${meta.accent}`, dot: meta.dot }
  }
  return { soft: false, color: e.color || EVENT_KINDS[e.kind]?.color || '#64748b' }
}

// ---- Drag & drop ----------------------------------------------------------
function readPayload(e) {
  try {
    return JSON.parse(e.dataTransfer.getData('application/json'))
  } catch (_) {
    return null
  }
}

function timeFromY(day, container, clientY) {
  const rect = container.getBoundingClientRect()
  let hourFloat = DAY_START_HOUR + (clientY - rect.top) / HOUR_HEIGHT
  hourFloat = Math.round(hourFloat * 4) / 4 // snap to 15 min
  hourFloat = Math.min(DAY_END_HOUR - 0.25, Math.max(DAY_START_HOUR, hourFloat))
  const h = Math.floor(hourFloat)
  const min = Math.round((hourFloat - h) * 60)
  return day.hour(h).minute(min).second(0)
}

async function onDropHour(day, e) {
  dragOverKey.value = null
  const payload = readPayload(e)
  if (!payload) return
  const start = timeFromY(day, e.currentTarget, e.clientY)

  if (payload.type === 'issue') {
    const issue = store.issues.find((i) => i.iid === payload.issue_iid)
    const estimateH = issue?.time_stats?.time_estimate
      ? Math.max(0.5, issue.time_stats.time_estimate / 3600)
      : 1
    await store.createEvent({
      title: payload.title,
      kind: 'ticket',
      issue_iid: payload.issue_iid,
      starts_at: start.toISOString(),
      ends_at: start.add(estimateH, 'hour').toISOString(),
      all_day: false,
      project_id: store.selectedProjectId,
      milestone_id: store.selectedMilestoneId,
    })
  } else if (payload.type === 'event-move') {
    const ev = store.events.find((x) => x.id === payload.id)
    if (ev) {
      const duration = dayjs(ev.ends_at).diff(dayjs(ev.starts_at), 'minute')
      await store.updateEvent(ev.id, {
        starts_at: start.toISOString(),
        ends_at: start.add(duration, 'minute').toISOString(),
        all_day: false,
      })
    }
  }
}

async function onDropAllDay(day, e) {
  dragOverKey.value = null
  const payload = readPayload(e)
  if (!payload) return
  const start = day.hour(9).minute(0).second(0)
  const end = day.hour(18).minute(0).second(0)

  if (payload.type === 'issue') {
    await store.createEvent({
      title: payload.title,
      kind: 'ticket',
      issue_iid: payload.issue_iid,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: true,
      project_id: store.selectedProjectId,
      milestone_id: store.selectedMilestoneId,
    })
  } else if (payload.type === 'event-move') {
    const ev = store.events.find((x) => x.id === payload.id)
    if (ev) {
      await store.updateEvent(ev.id, {
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: true,
      })
    }
  }
}

function onEventDragStart(ev, e) {
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/json', JSON.stringify({ type: 'event-move', id: ev.id }))
}

// ---- Modal ----------------------------------------------------------------
function openNew() {
  editingEvent.value = null
  modalOpen.value = true
}
function openSlot(day, hour) {
  editingEvent.value = {
    kind: 'other_project',
    starts_at: day.hour(hour).minute(0).toISOString(),
    ends_at: day.hour(hour + 1).minute(0).toISOString(),
  }
  modalOpen.value = true
}
function openEvent(ev) {
  editingEvent.value = ev
  modalOpen.value = true
}

const isToday = (day) => day.isSame(dayjs(), 'day')
</script>

<template>
  <div v-if="!hasMilestone" class="flex flex-col items-center justify-center py-24 text-center">
    <div class="rounded-2xl bg-white p-8 shadow-card">
      <CalendarRange class="mx-auto h-10 w-10 text-slate-300" />
      <h3 class="mt-3 text-lg font-semibold text-slate-700">Aucun sprint sélectionné</h3>
      <p class="mt-1 max-w-sm text-sm text-slate-500">
        Sélectionne un projet et un milestone pour planifier les tickets sur le calendrier.
      </p>
    </div>
  </div>

  <div v-else class="flex h-[calc(100vh-9rem)] gap-4">
    <!-- Sidebar: tickets to schedule -->
    <aside class="flex w-72 shrink-0 flex-col rounded-2xl bg-white p-4 shadow-card">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-700">À planifier</h3>
        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
          {{ store.unscheduledIssues.length }}
        </span>
      </div>

      <div class="mb-3 flex items-start gap-2 rounded-xl bg-brand-50 p-2.5 text-xs text-brand-700">
        <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Glisse un ticket sur un créneau horaire ou sur la bande « jour ».</span>
      </div>

      <div class="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2 scrollbar-slim">
        <TicketCard
          v-for="issue in store.unscheduledIssues"
          :key="issue.iid"
          :issue="issue"
          :status="store.statusFor(issue.iid)"
          :draggable="true"
          compact
        />
        <p
          v-if="!store.unscheduledIssues.length"
          class="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400"
        >
          Tous les tickets sont planifiés 🎉
        </p>
      </div>

      <button
        class="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        @click="openNew"
      >
        <Layers class="h-4 w-4" /> Bloc « autre projet »
      </button>
    </aside>

    <!-- Calendar -->
    <div class="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-card">
      <div class="flex">
        <!-- time gutter -->
        <div class="w-14 shrink-0 border-r border-slate-100">
          <div class="h-12 border-b border-slate-100" />
          <div class="border-b border-slate-100" :style="{ height: allDayLaneHeight + 'px' }">
            <div class="flex h-full items-center justify-end pr-2 text-[10px] font-medium uppercase text-slate-400">
              jour
            </div>
          </div>
          <div class="relative" :style="{ height: gridHeight + 'px' }">
            <div
              v-for="h in HOURS"
              :key="h"
              class="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-slate-400"
              :style="{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT + 'px' }"
            >
              {{ String(h).padStart(2, '0') }}:00
            </div>
          </div>
        </div>

        <!-- scrollable days -->
        <div class="flex-1 overflow-x-auto scrollbar-slim">
          <div class="flex min-w-max">
            <div
              v-for="day in days"
              :key="day.format('YYYY-MM-DD')"
              class="w-44 shrink-0 border-r border-slate-100 last:border-r-0"
            >
              <!-- day header -->
              <div
                class="flex h-12 flex-col items-center justify-center border-b border-slate-100"
                :class="isToday(day) ? 'bg-brand-50' : ''"
              >
                <span class="text-[11px] font-medium uppercase text-slate-400">{{ day.format('ddd') }}</span>
                <span
                  class="text-sm font-semibold"
                  :class="isToday(day) ? 'text-brand-600' : 'text-slate-700'"
                >
                  {{ day.format('D MMM') }}
                </span>
              </div>

              <!-- all-day lane -->
              <div
                class="space-y-1 border-b border-slate-100 p-1 transition"
                :style="{ height: allDayLaneHeight + 'px' }"
                :class="dragOverKey === 'ad-' + day.format('YYYY-MM-DD') ? 'bg-brand-50' : ''"
                @dragover.prevent="dragOverKey = 'ad-' + day.format('YYYY-MM-DD')"
                @dragleave="dragOverKey = null"
                @drop="onDropAllDay(day, $event)"
              >
                <div
                  v-for="ev in allDayEvents(day)"
                  :key="ev.id"
                  draggable="true"
                  class="cursor-pointer truncate rounded-md px-2 py-1 text-[11px] font-medium text-white shadow-sm"
                  :style="{ backgroundColor: eventVisual(ev).soft ? '#6366f1' : eventVisual(ev).color }"
                  @dragstart="onEventDragStart(ev, $event)"
                  @click="openEvent(ev)"
                >
                  {{ eventLabel(ev) }}
                </div>
              </div>

              <!-- hour grid -->
              <div
                class="relative transition"
                :style="{ height: gridHeight + 'px' }"
                :class="dragOverKey === 'h-' + day.format('YYYY-MM-DD') ? 'bg-brand-50/40' : ''"
                @dragover.prevent="dragOverKey = 'h-' + day.format('YYYY-MM-DD')"
                @dragleave="dragOverKey = null"
                @drop="onDropHour(day, $event)"
              >
                <!-- gridlines / click-to-add -->
                <div
                  v-for="h in HOURS"
                  :key="h"
                  class="group absolute inset-x-0 border-b border-slate-100"
                  :style="{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT + 'px', height: HOUR_HEIGHT + 'px' }"
                  @click="openSlot(day, h)"
                >
                  <Plus
                    class="absolute right-1 top-1 h-3.5 w-3.5 text-slate-300 opacity-0 transition group-hover:opacity-100"
                  />
                </div>

                <!-- events -->
                <template v-for="p in layout(dayEvents(day))" :key="p.e.id">
                  <div
                    draggable="true"
                    class="absolute cursor-pointer overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-[11px] shadow-sm transition hover:shadow-md"
                    :class="eventVisual(p.e).soft ? eventVisual(p.e).classes + ' text-slate-700' : 'text-white border-transparent'"
                    :style="{
                      ...eventStyle(p.e, p.total, p.col, day),
                      ...(eventVisual(p.e).soft ? {} : { backgroundColor: eventVisual(p.e).color }),
                    }"
                    @dragstart="onEventDragStart(p.e, $event)"
                    @click.stop="openEvent(p.e)"
                  >
                    <div class="flex items-center gap-1 font-medium leading-tight">
                      <span
                        v-if="eventVisual(p.e).soft"
                        class="h-1.5 w-1.5 shrink-0 rounded-full"
                        :class="eventVisual(p.e).dot"
                      />
                      <span class="truncate">{{ eventLabel(p.e) }}</span>
                    </div>
                    <div class="mt-0.5 opacity-70">
                      {{ dayjs(p.e.starts_at).format('HH:mm') }}–{{ dayjs(p.e.ends_at).format('HH:mm') }}
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EventModal :open="modalOpen" :event="editingEvent" @close="modalOpen = false" />
  </div>
</template>
