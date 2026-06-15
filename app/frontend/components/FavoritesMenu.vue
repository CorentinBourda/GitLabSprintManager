<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Star, X, Check } from 'lucide-vue-next'
import { useSprintStore } from '../stores/sprint'

const store = useSprintStore()
const open = ref(false)
const root = ref(null)

const canFavorite = computed(() => !!store.selectedProjectId && !!store.selectedMilestoneId)
const isCurrentFav = computed(() => !!store.currentFavorite)

function projectName(fav) {
  return store.localProjectFor(fav.project_id)?.name || fav.project_name || `Projet ${fav.project_id}`
}

async function go(fav) {
  open.value = false
  await store.goToSprint(fav)
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="relative flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-sm text-slate-600 shadow-sm transition hover:border-slate-300"
      title="Sprints favoris"
      @click.stop="open = !open"
    >
      <Star
        class="h-4 w-4"
        :class="isCurrentFav ? 'fill-amber-400 text-amber-400' : 'text-slate-400'"
      />
      <span v-if="store.favorites.length" class="text-xs font-semibold tabular-nums">
        {{ store.favorites.length }}
      </span>
    </button>

    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="open"
        class="absolute right-0 z-40 mt-1.5 w-72 origin-top overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <!-- Toggle the current sprint -->
        <button
          type="button"
          :disabled="!canFavorite"
          class="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          @click.stop="store.toggleFavorite()"
        >
          <Star
            class="h-4 w-4 shrink-0"
            :class="isCurrentFav ? 'fill-amber-400 text-amber-400' : 'text-slate-400'"
          />
          <span>{{ isCurrentFav ? 'Retirer ce sprint des favoris' : 'Mettre ce sprint en favori' }}</span>
        </button>

        <div class="max-h-72 overflow-y-auto p-1 scrollbar-slim">
          <p v-if="!store.favorites.length" class="px-3 py-4 text-center text-sm text-slate-400">
            Aucun favori
          </p>
          <div
            v-for="fav in store.favorites"
            :key="fav.id"
            class="group flex items-center gap-2 rounded-lg px-2.5 py-2 transition hover:bg-slate-50"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: store.localProjectFor(fav.project_id)?.color || '#94a3b8' }"
            />
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              :title="`${projectName(fav)} — ${fav.milestone_title}`"
              @click.stop="go(fav)"
            >
              <div class="truncate text-sm font-medium text-slate-700">{{ fav.milestone_title || 'Sprint' }}</div>
              <div class="truncate text-xs text-slate-400">{{ projectName(fav) }}</div>
            </button>
            <Check
              v-if="store.currentFavorite && store.currentFavorite.id === fav.id"
              class="h-4 w-4 shrink-0 text-brand-600"
            />
            <button
              type="button"
              class="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
              title="Retirer des favoris"
              @click.stop="store.removeFavorite(fav.id)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
