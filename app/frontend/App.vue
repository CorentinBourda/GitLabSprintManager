<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import {
  LayoutGrid, CalendarDays, Settings, GitMerge, FolderGit2, Milestone,
  AlertCircle, X, CircleDot,
} from 'lucide-vue-next'
import { useSprintStore } from './stores/sprint'
import SelectMenu from './components/SelectMenu.vue'
import SprintBoard from './components/SprintBoard.vue'
import SprintCalendar from './components/SprintCalendar.vue'
import SettingsView from './components/SettingsView.vue'

const store = useSprintStore()
const tab = ref('board')

const TABS = [
  { key: 'board', label: 'Tableau', icon: LayoutGrid },
  { key: 'calendar', label: 'Calendrier', icon: CalendarDays },
  { key: 'settings', label: 'Réglages', icon: Settings },
]

const projectOptions = computed(() =>
  store.projects
    .map((p) => {
      // Show the local custom name (e.g. a renamed project) when one exists.
      const local = store.localProjectFor(p.id)
      return {
        value: String(p.id),
        label: local?.name || p.name_with_namespace || p.name,
        sub: p.path_with_namespace,
        color: local?.color || null,
        custom: !!local,
      }
    })
    // Projects already tracked locally (custom) bubble up to the top.
    .sort((a, b) => Number(b.custom) - Number(a.custom))
)

const milestoneOptions = computed(() =>
  [...store.milestones]
    // Most recent sprints first so the relevant ones are at the top.
    .sort((a, b) => (b.due_date || b.start_date || '').localeCompare(a.due_date || a.start_date || ''))
    .map((m) => ({
      value: String(m.id),
      label: m.title,
      sub: m.due_date
        ? `${m.start_date ? dayjs(m.start_date).format('D MMM') + ' → ' : ''}${dayjs(m.due_date).format('D MMM YYYY')}`
        : 'Sans échéance',
    }))
)

function onProjectChange(id) {
  const project = store.projects.find((p) => String(p.id) === String(id))
  if (project) store.selectProject(project)
}

// --- Resume state from the URL (?project=&milestone=&view=) ----------------
function syncUrl() {
  const params = new URLSearchParams()
  if (store.selectedProjectId) params.set('project', store.selectedProjectId)
  if (store.selectedMilestoneId) params.set('milestone', store.selectedMilestoneId)
  if (tab.value) params.set('view', tab.value)
  const qs = params.toString()
  window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const urlProject = params.get('project')
  const urlMilestone = params.get('milestone')
  const urlView = params.get('view')
  if (urlView && TABS.some((t) => t.key === urlView)) tab.value = urlView

  await store.loadSettings()
  // The URL takes precedence over the locally-remembered selection.
  if (urlProject) store.selectedProjectId = urlProject
  if (urlMilestone) store.selectedMilestoneId = urlMilestone

  await Promise.all([
    store.loadEvents(),
    store.loadLocalProjects(),
    store.settings.configured ? store.loadProjects() : null,
  ])
  // Ensure already-scheduled tickets have a colored project, even old ones.
  store.backfillEventProjects()
  if (store.selectedProjectId) await store.loadMilestones()
  if (!store.settings.configured) tab.value = 'settings'

  // Keep the URL in sync with any later change so a reload resumes here.
  watch([() => store.selectedProjectId, () => store.selectedMilestoneId, tab], syncUrl, { flush: 'post' })
  syncUrl()
})
</script>

<template>
  <div class="flex min-h-full flex-col">
    <!-- Top bar -->
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div class="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3">
        <!-- Brand -->
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
            <GitMerge class="h-5 w-5" />
          </div>
          <div class="leading-tight">
            <div class="text-sm font-bold text-slate-800">Sprint Manager</div>
            <div class="text-[11px] text-slate-400">GitLab · lecture seule</div>
          </div>
        </div>

        <!-- Selectors -->
        <div class="flex flex-1 items-center gap-2.5">
          <div class="w-64">
            <SelectMenu
              :model-value="store.selectedProjectId"
              :options="projectOptions"
              :loading="store.loading.projects"
              :icon="FolderGit2"
              placeholder="Choisir un projet"
              searchable
              :disabled="!store.settings.configured"
              @update:model-value="onProjectChange"
              @search="store.loadProjects($event)"
            />
          </div>
          <div class="w-56">
            <SelectMenu
              :model-value="store.selectedMilestoneId"
              :options="milestoneOptions"
              :loading="store.loading.milestones"
              :icon="Milestone"
              placeholder="Choisir un milestone"
              searchable
              :disabled="!store.selectedProjectId"
              @update:model-value="store.selectMilestone($event)"
            />
          </div>
        </div>

        <!-- Connection indicator -->
        <div
          v-if="store.settings.configured"
          class="hidden items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200 sm:flex"
        >
          <CircleDot class="h-3.5 w-3.5 text-emerald-500" />
          {{ store.settings.base_url?.replace(/^https?:\/\//, '') }}
        </div>

        <!-- Tabs -->
        <nav class="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            v-for="t in TABS"
            :key="t.key"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition"
            :class="tab === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
            @click="tab = t.key"
          >
            <component :is="t.icon" class="h-4 w-4" />
            <span class="hidden md:inline">{{ t.label }}</span>
          </button>
        </nav>
      </div>
    </header>

    <!-- Error toast -->
    <transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="store.error"
        class="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl bg-rose-600 px-4 py-3 text-sm text-white shadow-2xl"
      >
        <AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
        <span class="flex-1">{{ store.error }}</span>
        <button class="text-white/80 transition hover:text-white" @click="store.error = null">
          <X class="h-4 w-4" />
        </button>
      </div>
    </transition>

    <!-- Content -->
    <main class="mx-auto w-full max-w-[1500px] flex-1 px-5 py-6">
      <SprintBoard v-show="tab === 'board'" />
      <SprintCalendar v-if="tab === 'calendar'" />
      <SettingsView v-if="tab === 'settings'" />
    </main>
  </div>
</template>
