<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import { STATUSES, statusMeta } from '../lib/constants'

const props = defineProps({
  modelValue: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])

const MENU_WIDTH = 224 // matches w-56

const open = ref(false)
const trigger = ref(null)
const menu = ref(null)
const coords = ref({ top: 0, left: 0 })
const meta = computed(() => statusMeta(props.modelValue))

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    position()
  }
}

// Position the teleported menu (fixed) so its right edge aligns with the
// trigger, then clamp into the viewport. Teleporting to <body> avoids being
// clipped by the board's horizontally-scrolling column container.
function position() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  let left = rect.right - MENU_WIDTH
  left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))
  coords.value = { top: rect.bottom + 6, left }
}

function choose(key) {
  emit('update:modelValue', key)
  open.value = false
}

function onClickOutside(e) {
  if (trigger.value?.contains(e.target) || menu.value?.contains(e.target)) return
  open.value = false
}
function onScroll() {
  if (open.value) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="relative inline-block">
    <button
      ref="trigger"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition hover:brightness-95"
      :class="meta.badge"
      @click.stop="toggle"
    >
      <span class="h-1.5 w-1.5 rounded-full" :class="meta.dot" />
      {{ meta.label }}
      <ChevronDown class="h-3.5 w-3.5 opacity-70" />
    </button>

    <Teleport to="body">
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
      >
        <div
          v-if="open"
          ref="menu"
          class="fixed z-[60] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          :style="{ top: coords.top + 'px', left: coords.left + 'px' }"
        >
          <button
            v-for="s in STATUSES"
            :key="s.key"
            type="button"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            @click.stop="choose(s.key)"
          >
            <span class="h-2 w-2 rounded-full" :class="s.dot" />
            <span class="flex-1">{{ s.label }}</span>
            <Check v-if="s.key === modelValue" class="h-4 w-4 text-brand-600" />
          </button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>
