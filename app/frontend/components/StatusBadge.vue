<script setup>
import { computed } from 'vue'
import { statusMeta } from '../lib/constants'

const props = defineProps({
  status: { type: String, required: true },
  size: { type: String, default: 'sm' }, // sm | xs
})

const meta = computed(() => statusMeta(props.status))
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-medium"
    :class="[meta.badge, size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs']"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="meta.dot" />
    {{ meta.label }}
  </span>
</template>
