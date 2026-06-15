<script setup>
import { computed } from 'vue'

const props = defineProps({
  distribution: { type: Array, required: true }, // [{key,label,count,pct,bar,dot}]
})

const total = computed(() => props.distribution.reduce((s, d) => s + d.count, 0))
</script>

<template>
  <div>
    <div class="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
      <template v-if="total">
        <div
          v-for="d in distribution.filter((x) => x.count)"
          :key="d.key"
          class="h-full transition-all duration-500"
          :class="d.bar"
          :style="{ width: `${(d.count / total) * 100}%` }"
          :title="`${d.label}: ${d.count}`"
        />
      </template>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <div v-for="d in distribution" :key="d.key" class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="d.dot" />
        <div class="min-w-0">
          <div class="flex items-baseline gap-1.5">
            <span class="text-lg font-semibold tabular-nums text-slate-800">{{ d.count }}</span>
            <span class="text-xs text-slate-400">{{ d.pct }}%</span>
          </div>
          <div class="truncate text-xs text-slate-500">{{ d.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
