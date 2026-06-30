<script setup>
import { ref, watch, computed } from 'vue'
import dayjs from 'dayjs'
import { X, Trash2, Loader2 } from 'lucide-vue-next'
import { useSprintStore } from '../stores/sprint'
import { EVENT_KINDS } from '../lib/constants'

const props = defineProps({
  open: { type: Boolean, default: false },
  event: { type: Object, default: null }, // existing event when editing
})
const emit = defineEmits(['close'])

const store = useSprintStore()
const saving = ref(false)
const confirmingDelete = ref(false)

const fmt = (d) => dayjs(d).format('YYYY-MM-DDTHH:mm')

// The end must be strictly after the start (unless it's an all-day block, whose
// hours are derived elsewhere). Blocks saving and shows an inline hint.
const datesInvalid = computed(
  () => !form.value.all_day && !dayjs(form.value.ends_at).isAfter(dayjs(form.value.starts_at))
)

const form = ref({
  title: '',
  kind: 'other_project',
  starts_at: fmt(dayjs()),
  ends_at: fmt(dayjs().add(1, 'hour')),
  all_day: false,
  color: EVENT_KINDS.other_project.color,
  notes: '',
  issue_iid: null,
})

const isEditing = computed(() => !!props.event?.id)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    confirmingDelete.value = false
    const e = props.event || {}
    form.value = {
      title: e.title || '',
      kind: e.kind || 'other_project',
      starts_at: fmt(e.starts_at || dayjs()),
      ends_at: fmt(e.ends_at || dayjs(e.starts_at || undefined).add(1, 'hour')),
      all_day: e.all_day || false,
      color: e.color || EVENT_KINDS[e.kind || 'other_project'].color,
      notes: e.notes || '',
      issue_iid: e.issue_iid ?? null,
      milestone_id: e.milestone_id ?? store.selectedMilestoneId,
      project_id: e.project_id ?? store.selectedProjectId,
    }
  }
)

watch(
  () => form.value.kind,
  (kind) => {
    if (!isEditing.value) form.value.color = EVENT_KINDS[kind].color
  }
)

async function submit() {
  if (datesInvalid.value) return
  saving.value = true
  try {
    const payload = {
      title: form.value.title || EVENT_KINDS[form.value.kind].label,
      kind: form.value.kind,
      starts_at: dayjs(form.value.starts_at).toISOString(),
      ends_at: dayjs(form.value.ends_at).toISOString(),
      all_day: form.value.all_day,
      color: form.value.color,
      notes: form.value.notes,
      issue_iid: form.value.kind === 'ticket' ? form.value.issue_iid : null,
      // Preserve the event's own project/url/milestone when editing; only fall
      // back to the current selection for brand-new events.
      web_url: form.value.kind === 'ticket' ? (props.event?.web_url ?? null) : null,
      project_id: form.value.project_id ?? store.selectedProjectId,
      milestone_id: form.value.milestone_id ?? store.selectedMilestoneId,
    }
    if (isEditing.value) await store.updateEvent(props.event.id, payload)
    else await store.createEvent(payload)
    emit('close')
  } catch (e) {
    store.setError(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!isEditing.value) return
  // First click arms the confirmation; second click actually deletes.
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    return
  }
  saving.value = true
  try {
    await store.deleteEvent(props.event.id)
    emit('close')
  } catch (e) {
    store.setError(e)
  } finally {
    saving.value = false
    confirmingDelete.value = false
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

      <div class="relative w-full max-w-md animate-fade-in rounded-2xl bg-white p-6 shadow-2xl">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-800">
            {{ isEditing ? 'Modifier le créneau' : 'Nouveau créneau' }}
          </h3>
          <button class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100" @click="emit('close')">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Kind -->
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="(meta, key) in EVENT_KINDS"
              :key="key"
              type="button"
              class="rounded-xl border px-3 py-2 text-sm font-medium transition"
              :class="form.kind === key ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
              :style="form.kind === key ? { backgroundColor: meta.color } : {}"
              @click="form.kind = key"
            >
              {{ meta.label }}
            </button>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">Titre</label>
            <input
              v-model="form.title"
              type="text"
              :placeholder="EVENT_KINDS[form.kind].label"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-500">Début</label>
              <input
                v-model="form.starts_at"
                type="datetime-local"
                class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-500">Fin</label>
              <input
                v-model="form.ends_at"
                type="datetime-local"
                class="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                :class="datesInvalid ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-brand-400 focus:ring-brand-100'"
              />
            </div>
          </div>

          <p v-if="datesInvalid" class="-mt-2 text-xs font-medium text-rose-500">
            La fin doit être postérieure au début.
          </p>

          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="form.all_day" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
              Journée entière
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              Couleur
              <input v-model="form.color" type="color" class="h-7 w-10 cursor-pointer rounded border border-slate-200" />
            </label>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">Notes</label>
            <textarea
              v-model="form.notes"
              rows="2"
              class="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        <div class="mt-6 flex items-center gap-3">
          <button
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="saving || datesInvalid"
            @click="submit"
          >
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            {{ isEditing ? 'Enregistrer' : 'Ajouter' }}
          </button>
          <button
            v-if="isEditing"
            class="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition"
            :class="confirmingDelete ? 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'"
            :disabled="saving"
            :title="confirmingDelete ? 'Cliquer à nouveau pour confirmer' : 'Supprimer le créneau'"
            @click="remove"
          >
            <Trash2 class="h-4 w-4" />
            <span v-if="confirmingDelete">Confirmer</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
