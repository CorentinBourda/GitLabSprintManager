<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ChevronsUpDown, Check, Search, Loader2 } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label, sub }]
  placeholder: { type: String, default: 'Sélectionner…' },
  searchable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  icon: { type: [Object, Function], default: null },
})
const emit = defineEmits(['update:modelValue', 'search'])

const open = ref(false)
const query = ref('')
const root = ref(null)
const searchInput = ref(null)

const selected = computed(() =>
  props.options.find((o) => String(o.value) === String(props.modelValue))
)

// Full text for tooltips (label + sub-line, e.g. sprint dates / project path).
function optionTitle(option) {
  if (!option) return props.placeholder
  return option.sub ? `${option.label} — ${option.sub}` : option.label
}

const filtered = computed(() => {
  if (!props.searchable || !query.value) return props.options
  const q = query.value.toLowerCase()
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value && props.searchable) {
    await nextTick()
    searchInput.value?.focus()
  }
}

function choose(option) {
  emit('update:modelValue', option.value)
  open.value = false
  query.value = ''
}

let debounce
function onSearch() {
  clearTimeout(debounce)
  debounce = setTimeout(() => emit('search', query.value), 300)
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
      :disabled="disabled"
      :title="optionTitle(selected)"
      class="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      @click.stop="toggle"
    >
      <component :is="icon" v-if="icon" class="h-4 w-4 shrink-0 text-slate-400" />
      <span class="min-w-0 flex-1 truncate" :class="selected ? 'text-slate-800' : 'text-slate-400'">
        {{ selected ? selected.label : placeholder }}
      </span>
      <Loader2 v-if="loading" class="h-4 w-4 animate-spin text-slate-400" />
      <ChevronsUpDown v-else class="h-4 w-4 shrink-0 text-slate-400" />
    </button>

    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="open"
        class="absolute left-0 z-40 mt-1.5 w-full min-w-[16rem] origin-top overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div v-if="searchable" class="border-b border-slate-100 p-2">
          <div class="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
            <Search class="h-4 w-4 text-slate-400" />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              placeholder="Rechercher…"
              class="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              @input="onSearch"
            />
          </div>
        </div>

        <div class="max-h-72 overflow-y-auto p-1 scrollbar-slim">
          <p v-if="loading" class="px-3 py-4 text-center text-sm text-slate-400">Chargement…</p>
          <p v-else-if="!filtered.length" class="px-3 py-4 text-center text-sm text-slate-400">
            Aucun résultat
          </p>
          <button
            v-for="option in filtered"
            :key="option.value"
            type="button"
            :title="optionTitle(option)"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50"
            @click.stop="choose(option)"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-slate-700">{{ option.label }}</div>
              <div v-if="option.sub" class="truncate text-xs text-slate-400">{{ option.sub }}</div>
            </div>
            <Check
              v-if="String(option.value) === String(modelValue)"
              class="h-4 w-4 shrink-0 text-brand-600"
            />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
