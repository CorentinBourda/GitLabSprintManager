import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import api from '../lib/api'
import { STATUSES, DEFAULT_STATUS } from '../lib/constants'

const LS_PROJECT = 'gsm.projectId'
const LS_PROJECT_NAME = 'gsm.projectName'
const LS_MILESTONE = 'gsm.milestoneId'

// Auto-dismiss timer for the error toast (kept out of reactive state).
let errorTimer = null

export const useSprintStore = defineStore('sprint', {
  state: () => ({
    settings: { base_url: '', configured: false, token_set: false },
    connection: { ok: false, user: null, error: null },

    projects: [],
    milestones: [],
    issues: [],
    statuses: {}, // issue_iid -> status key
    mergeRequests: {}, // issue_iid -> [merge requests]
    events: [],
    localProjects: [], // locally-tracked projects (name + color), keyed by gitlab id
    favorites: [], // bookmarked sprints (project + milestone) for quick access

    selectedProjectId: localStorage.getItem(LS_PROJECT) || '',
    selectedProjectName: localStorage.getItem(LS_PROJECT_NAME) || '',
    selectedMilestoneId: localStorage.getItem(LS_MILESTONE) || '',

    // Active top-level tab ('board' | 'calendar' | 'settings'). Lives in the
    // store so actions (e.g. jumping to a favorite) can switch views.
    activeView: 'board',

    loading: { projects: false, milestones: false, issues: false, events: false },
    error: null,
    // Set when the current sprint's issues fail to load, so the board can show
    // an explicit error + retry state instead of a silent empty board.
    issuesError: null,
  }),

  getters: {
    currentMilestone(state) {
      return state.milestones.find((m) => String(m.id) === String(state.selectedMilestoneId)) || null
    },

    // Sprint boundaries derived from the milestone dates, with sane fallbacks.
    sprintStart() {
      const m = this.currentMilestone
      if (m?.start_date) return dayjs(m.start_date).startOf('day')
      return dayjs().startOf('week')
    },
    sprintEnd() {
      const m = this.currentMilestone
      if (m?.due_date) return dayjs(m.due_date).endOf('day')
      return this.sprintStart.add(13, 'day').endOf('day')
    },
    sprintDays() {
      const days = []
      let cursor = this.sprintStart.startOf('day')
      const end = this.sprintEnd.startOf('day')
      let guard = 0
      while ((cursor.isBefore(end) || cursor.isSame(end)) && guard < 120) {
        days.push(cursor)
        cursor = cursor.add(1, 'day')
        guard += 1
      }
      return days
    },

    // Local project (name + color) for a given GitLab project id, if tracked.
    localProjectFor: (state) => (gitlabProjectId) =>
      state.localProjects.find((p) => String(p.gitlab_project_id) === String(gitlabProjectId)) || null,

    currentLocalProject(state) {
      return state.localProjects.find(
        (p) => String(p.gitlab_project_id) === String(state.selectedProjectId)
      ) || null
    },

    // Color to use for a ticket / project-day event, from its owning project.
    colorForEvent(state) {
      return (event) => {
        const p = state.localProjects.find(
          (x) => String(x.gitlab_project_id) === String(event.project_id)
        )
        return p?.color || null
      }
    },

    favoriteFor: (state) => (projectId, milestoneId) =>
      state.favorites.find(
        (f) =>
          String(f.project_id) === String(projectId) &&
          String(f.milestone_id) === String(milestoneId)
      ) || null,

    currentFavorite(state) {
      return state.favorites.find(
        (f) =>
          String(f.project_id) === String(state.selectedProjectId) &&
          String(f.milestone_id) === String(state.selectedMilestoneId)
      ) || null
    },

    statusFor: (state) => (iid) => state.statuses[iid] || DEFAULT_STATUS,

    mergeRequestsFor: (state) => (iid) => state.mergeRequests[iid] || [],

    // { status_key: [issues...] } grouped for the board.
    issuesByStatus(state) {
      const groups = {}
      STATUSES.forEach((s) => (groups[s.key] = []))
      state.issues.forEach((issue) => {
        const key = state.statuses[issue.iid] || DEFAULT_STATUS
        ;(groups[key] || groups[DEFAULT_STATUS]).push(issue)
      })
      return groups
    },

    // Distribution counts + percentages for the marker breakdown.
    distribution(state) {
      const total = state.issues.length || 0
      return STATUSES.map((s) => {
        const count = state.issues.filter(
          (i) => (state.statuses[i.iid] || DEFAULT_STATUS) === s.key
        ).length
        return { ...s, count, pct: total ? Math.round((count / total) * 100) : 0 }
      })
    },

    // Estimated time still to spend on the sprint (GitLab time tracking),
    // summed over tickets not yet locally marked "merged".
    remainingEstimateSeconds(state) {
      return state.issues.reduce((sum, i) => {
        if ((state.statuses[i.iid] || DEFAULT_STATUS) === 'merged') return sum
        const est = i.time_stats?.time_estimate || 0
        const spent = i.time_stats?.total_time_spent || 0
        return sum + Math.max(0, est - spent)
      }, 0)
    },

    totalEstimateSeconds(state) {
      return state.issues.reduce((sum, i) => sum + (i.time_stats?.time_estimate || 0), 0)
    },

    ticketEventsByIssue(state) {
      const map = {}
      state.events
        .filter((e) => e.kind === 'ticket' && e.issue_iid != null)
        .forEach((e) => {
          map[e.issue_iid] = map[e.issue_iid] || []
          map[e.issue_iid].push(e)
        })
      return map
    },

    // Tickets of the sprint that haven't been scheduled on the calendar yet.
    unscheduledIssues(state) {
      const scheduled = new Set(
        state.events.filter((e) => e.kind === 'ticket').map((e) => e.issue_iid)
      )
      return state.issues.filter((i) => !scheduled.has(i.iid))
    },
  },

  actions: {
    // Show a transient error toast. It auto-dismisses after a few seconds so a
    // stale message never lingers (e.g. after navigating to a sprint that works).
    setError(e) {
      this.error = e?.message || String(e)
      clearTimeout(errorTimer)
      if (this.error) errorTimer = setTimeout(() => (this.error = null), 6000)
    },

    clearError() {
      clearTimeout(errorTimer)
      this.error = null
    },

    // ---- Settings -----------------------------------------------------------
    async loadSettings() {
      this.settings = (await api.get('/settings')).data
    },
    async saveSettings(payload) {
      this.settings = (await api.put('/settings', { settings: payload })).data
      return this.settings
    },
    async testConnection() {
      this.connection = { ok: false, user: null, error: null }
      try {
        const { data } = await api.get('/gitlab/connection')
        this.connection = { ok: true, user: data.user, error: null }
      } catch (e) {
        this.connection = { ok: false, user: null, error: e.message }
      }
      return this.connection
    },

    // ---- GitLab data (read-only) -------------------------------------------
    async loadProjects(search = '') {
      this.loading.projects = true
      try {
        const { data } = await api.get('/gitlab/projects', { params: { search } })
        // Merge into the existing pool rather than replacing it: a server-side
        // search that matches nothing (GitLab can't match custom favorite names
        // or accent-folded queries) must not wipe the already-loaded projects,
        // which the client-side fuzzy filter can still match.
        const byId = new Map(this.projects.map((p) => [String(p.id), p]))
        data.forEach((p) => byId.set(String(p.id), p))
        this.projects = [...byId.values()]
      } catch (e) {
        this.setError(e)
      } finally {
        this.loading.projects = false
      }
    },

    async selectProject(project) {
      this.selectedProjectId = String(project.id)
      this.selectedProjectName = project.name_with_namespace || project.name
      localStorage.setItem(LS_PROJECT, this.selectedProjectId)
      localStorage.setItem(LS_PROJECT_NAME, this.selectedProjectName)
      this.selectedMilestoneId = ''
      this.milestones = []
      this.issues = []
      // "Start working on a project" → ensure a local project (name + color).
      // Name = last path segment (e.g. "ca-roule-web"), not the full namespace.
      const shortName =
        project.path || (project.name_with_namespace || project.name || '').split('/').pop().trim()
      this.ensureLocalProject(this.selectedProjectId, shortName)
      await this.loadMilestones()
    },

    async loadMilestones() {
      if (!this.selectedProjectId) return
      this.loading.milestones = true
      try {
        const { data } = await api.get('/gitlab/milestones', {
          params: { project_id: this.selectedProjectId, state: 'active' },
        })
        this.milestones = data
        if (this.selectedMilestoneId && this.currentMilestone) {
          await this.selectMilestone(this.selectedMilestoneId)
        }
      } catch (e) {
        this.setError(e)
      } finally {
        this.loading.milestones = false
      }
    },

    async selectMilestone(id) {
      this.selectedMilestoneId = String(id)
      localStorage.setItem(LS_MILESTONE, this.selectedMilestoneId)
      this.mergeRequests = {}
      await Promise.all([this.loadIssues(), this.loadStatuses()])
      this.loadMergeRequests() // fire-and-forget; cards update reactively
    },

    async loadIssues() {
      const milestone = this.currentMilestone
      if (!milestone) return
      this.loading.issues = true
      try {
        const { data } = await api.get('/gitlab/issues', {
          params: { project_id: this.selectedProjectId, milestone_id: milestone.id },
        })
        this.issues = data
        // A successful load clears any previous failure + stale toast so the
        // board doesn't keep showing an error from another project/sprint.
        this.issuesError = null
        this.clearError()
      } catch (e) {
        this.issues = []
        this.issuesError = e?.message || String(e)
        this.setError(e)
      } finally {
        this.loading.issues = false
      }
    },

    // Reload the currently-selected sprint (used by the board's "Retry" button).
    async retrySprint() {
      if (!this.selectedMilestoneId) return
      await this.selectMilestone(this.selectedMilestoneId)
    },

    // ---- Local markers ------------------------------------------------------
    async loadStatuses() {
      if (!this.selectedProjectId) return
      const { data } = await api.get('/ticket_statuses', {
        params: { project_id: this.selectedProjectId },
      })
      const map = {}
      data.forEach((s) => (map[s.issue_iid] = s.status))
      this.statuses = map
    },

    // Fetch related merge requests for every sprint ticket, in parallel.
    async loadMergeRequests() {
      const issues = this.issues
      if (!issues.length || !this.selectedProjectId) return
      const entries = await Promise.all(
        issues.map(async (issue) => {
          try {
            const { data } = await api.get('/gitlab/merge_requests', {
              params: { project_id: this.selectedProjectId, issue_iid: issue.iid },
            })
            return [issue.iid, data]
          } catch (_) {
            return [issue.iid, []]
          }
        })
      )
      this.mergeRequests = Object.fromEntries(entries)
    },

    async setStatus(issue, status) {
      const previous = this.statuses[issue.iid]
      this.statuses = { ...this.statuses, [issue.iid]: status } // optimistic
      try {
        await api.post('/ticket_statuses', {
          ticket_status: { project_id: this.selectedProjectId, issue_iid: issue.iid, status },
        })
      } catch (e) {
        this.statuses = { ...this.statuses, [issue.iid]: previous }
        this.setError(e)
      }
    },

    // ---- Local calendar events ---------------------------------------------
    async loadEvents() {
      this.loading.events = true
      try {
        this.events = (await api.get('/calendar_events')).data
      } catch (e) {
        this.setError(e)
      } finally {
        this.loading.events = false
      }
    },

    async createEvent(payload) {
      const { data } = await api.post('/calendar_events', { calendar_event: payload })
      this.events = [...this.events, data]
      return data
    },

    async updateEvent(id, payload) {
      const { data } = await api.put(`/calendar_events/${id}`, { calendar_event: payload })
      this.events = this.events.map((e) => (e.id === id ? data : e))
      return data
    },

    async deleteEvent(id) {
      await api.delete(`/calendar_events/${id}`)
      this.events = this.events.filter((e) => e.id !== id)
    },

    // ---- Local projects (name + color) -------------------------------------
    async loadLocalProjects() {
      try {
        this.localProjects = (await api.get('/projects')).data
      } catch (e) {
        this.setError(e)
      }
    },

    // Upsert the local project for a GitLab id. Adds it to the cache so tickets
    // and bands can be colored immediately.
    async ensureLocalProject(gitlabProjectId, name) {
      if (!gitlabProjectId) return null
      const existing = this.localProjectFor(gitlabProjectId)
      if (existing) return existing
      try {
        const { data } = await api.post('/projects', {
          project: { gitlab_project_id: String(gitlabProjectId), name },
        })
        if (!this.localProjectFor(data.gitlab_project_id)) {
          this.localProjects = [...this.localProjects, data]
        }
        return data
      } catch (e) {
        this.setError(e)
        return null
      }
    },

    async updateLocalProject(id, payload) {
      const { data } = await api.put(`/projects/${id}`, { project: payload })
      this.localProjects = this.localProjects.map((p) => (p.id === id ? data : p))
      return data
    },

    // ---- Favorite sprints --------------------------------------------------
    async loadFavorites() {
      try {
        this.favorites = (await api.get('/favorites')).data
      } catch (e) {
        this.setError(e)
      }
    },

    // Toggle the currently-selected sprint as a favorite.
    async toggleFavorite() {
      if (!this.selectedProjectId || !this.selectedMilestoneId) return
      const existing = this.currentFavorite
      if (existing) {
        await api.delete(`/favorites/${existing.id}`)
        this.favorites = this.favorites.filter((f) => f.id !== existing.id)
        return
      }
      const { data } = await api.post('/favorites', {
        favorite: {
          project_id: this.selectedProjectId,
          project_name: this.currentLocalProject?.name || this.selectedProjectName,
          milestone_id: this.selectedMilestoneId,
          milestone_title: this.currentMilestone?.title || '',
        },
      })
      this.favorites = [...this.favorites, data]
    },

    async removeFavorite(id) {
      await api.delete(`/favorites/${id}`)
      this.favorites = this.favorites.filter((f) => f.id !== id)
    },

    // Jump straight to a bookmarked sprint (project + milestone) and load it.
    async goToSprint(favorite) {
      this.selectedProjectId = String(favorite.project_id)
      this.selectedProjectName = favorite.project_name || this.selectedProjectName
      localStorage.setItem(LS_PROJECT, this.selectedProjectId)
      localStorage.setItem(LS_PROJECT_NAME, this.selectedProjectName)
      this.ensureLocalProject(this.selectedProjectId, null)
      // Surface the sprint right away rather than leaving the user on Settings.
      if (this.activeView === 'settings') this.activeView = 'board'
      await this.loadMilestones()
      await this.selectMilestone(favorite.milestone_id)
    },

    // Create a local project (with name resolved by the backend) for every
    // GitLab project that already has scheduled events, so older tickets get
    // their own color without re-selecting the project.
    async backfillEventProjects() {
      const ids = [
        ...new Set(
          this.events
            .filter((e) => e.project_id != null && (e.kind === 'ticket' || e.kind === 'project_day'))
            .map((e) => String(e.project_id))
        ),
      ]
      for (const id of ids) {
        if (!this.localProjectFor(id)) await this.ensureLocalProject(id, null)
      }
    },

    // Ensure an all-day "working on this project" band exists for `day`.
    // Called whenever a ticket of the current project is scheduled on a day.
    async ensureProjectDay(day, projectId = this.selectedProjectId) {
      if (!projectId) return
      // Make sure the local project (color) exists even after a page reload,
      // where selectProject() may not have run.
      await this.ensureLocalProject(projectId, null)
      const already = this.events.some(
        (e) =>
          e.kind === 'project_day' &&
          String(e.project_id) === String(projectId) &&
          dayjs(e.starts_at).isSame(day, 'day')
      )
      if (already) return
      const start = day.hour(9).minute(0).second(0)
      const end = day.hour(18).minute(0).second(0)
      await this.createEvent({
        title: this.localProjectFor(projectId)?.name || this.selectedProjectName,
        kind: 'project_day',
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: true,
        project_id: projectId,
        milestone_id: this.selectedMilestoneId,
      })
    },
  },
})
