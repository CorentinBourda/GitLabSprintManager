<script setup>
import { ref, reactive, computed } from 'vue'
import { Link2, KeyRound, CheckCircle2, XCircle, Loader2, ShieldCheck, Save } from 'lucide-vue-next'
import { useSprintStore } from '../stores/sprint'
import { avatarSrc } from '../lib/gitlab'

const store = useSprintStore()

const form = reactive({
  base_url: store.settings.base_url || 'https://gitlab.com',
  token: '',
})

const saving = ref(false)
const testing = ref(false)
const saved = ref(false)

const tokenPlaceholder = computed(() =>
  store.settings.token_set ? '•••••••••• (token enregistré — laisser vide pour conserver)' : 'glpat-xxxxxxxxxxxxxxxxxxxx'
)

async function save() {
  saving.value = true
  saved.value = false
  try {
    await store.saveSettings({ base_url: form.base_url, token: form.token })
    form.token = ''
    saved.value = true
    setTimeout(() => (saved.value = false), 2500)
    await store.loadProjects()
  } catch (e) {
    store.setError(e)
  } finally {
    saving.value = false
  }
}

async function test() {
  testing.value = true
  try {
    await store.testConnection()
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <div>
      <h2 class="text-xl font-bold text-slate-800">Connexion GitLab</h2>
      <p class="mt-1 text-sm text-slate-500">
        Cette application est en <span class="font-semibold text-slate-700">lecture seule</span> :
        le token sert uniquement à lire vos milestones et tickets. Rien n'est jamais créé
        ni modifié sur GitLab.
      </p>
    </div>

    <div class="space-y-5 rounded-2xl bg-white p-6 shadow-card">
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700">URL de l'instance GitLab</label>
        <div class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <Link2 class="h-4 w-4 text-slate-400" />
          <input
            v-model="form.base_url"
            type="url"
            placeholder="https://gitlab.com"
            class="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
        <p class="mt-1 text-xs text-slate-400">Ex. https://gitlab.com ou votre instance auto-hébergée.</p>
      </div>

      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700">Personal Access Token</label>
        <div class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <KeyRound class="h-4 w-4 text-slate-400" />
          <input
            v-model="form.token"
            type="password"
            :placeholder="tokenPlaceholder"
            autocomplete="off"
            class="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
        <p class="mt-1 text-xs text-slate-400">
          Scope <code class="rounded bg-slate-100 px-1 py-0.5 text-[11px]">read_api</code> suffisant.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3 pt-1">
        <button
          class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          :disabled="saving"
          @click="save"
        >
          <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          Enregistrer
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          :disabled="testing || !store.settings.configured"
          @click="test"
        >
          <Loader2 v-if="testing" class="h-4 w-4 animate-spin" />
          <ShieldCheck v-else class="h-4 w-4" />
          Tester la connexion
        </button>

        <transition enter-active-class="transition" enter-from-class="opacity-0">
          <span v-if="saved" class="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
            <CheckCircle2 class="h-4 w-4" /> Enregistré
          </span>
        </transition>
      </div>

      <!-- Connection result -->
      <div
        v-if="store.connection.ok"
        class="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200"
      >
        <CheckCircle2 class="h-5 w-5" />
        <span>
          Connecté en tant que
          <span class="font-semibold">{{ store.connection.user?.name }}</span>
          (@{{ store.connection.user?.username }})
        </span>
        <img v-if="store.connection.user?.avatar_url" :src="avatarSrc(store.connection.user.avatar_url, store.settings.base_url)" class="ml-auto h-7 w-7 rounded-full object-cover" />
      </div>
      <div
        v-else-if="store.connection.error"
        class="flex items-center gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"
      >
        <XCircle class="h-5 w-5" />
        {{ store.connection.error }}
      </div>
    </div>
  </div>
</template>
