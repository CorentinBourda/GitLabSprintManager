<script setup>
import { ref, watch } from 'vue'
import { X, Loader2 } from 'lucide-vue-next'
import { useSprintStore } from '../stores/sprint'
import { PROJECT_PALETTE } from '../lib/constants'

const props = defineProps({
  open: { type: Boolean, default: false },
  project: { type: Object, default: null }, // local project { id, name, color }
})
const emit = defineEmits(['close'])

const store = useSprintStore()
const saving = ref(false)
const form = ref({ name: '', color: '#6366f1' })

watch(
  () => props.open,
  (open) => {
    if (!open || !props.project) return
    form.value = { name: props.project.name || '', color: props.project.color || '#6366f1' }
  }
)

async function submit() {
  if (!props.project?.id) return
  saving.value = true
  try {
    await store.updateLocalProject(props.project.id, {
      name: form.value.name,
      color: form.value.color,
    })
    emit('close')
  } catch (e) {
    store.setError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <transition
    enter-active-class="transition duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-150"
    leave-to-class="opacity-0"
  >
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="emit('close')" />

      <div class="relative w-full max-w-sm animate-fade-in rounded-2xl bg-white p-6 shadow-2xl">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-800">Projet</h3>
          <button class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100" @click="emit('close')">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">Nom</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-medium text-slate-500">Couleur</label>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="c in PROJECT_PALETTE"
                :key="c"
                type="button"
                class="h-7 w-7 rounded-full ring-2 ring-offset-2 transition"
                :class="form.color.toLowerCase() === c.toLowerCase() ? 'ring-slate-400' : 'ring-transparent'"
                :style="{ backgroundColor: c }"
                @click="form.color = c"
              />
              <input
                v-model="form.color"
                type="color"
                class="h-7 w-10 cursor-pointer rounded border border-slate-200"
                title="Couleur personnalisée"
              />
            </div>
          </div>
        </div>

        <div class="mt-6">
          <button
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            :disabled="saving"
            @click="submit"
          >
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
