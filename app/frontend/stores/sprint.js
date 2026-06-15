import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import api from '../lib/api'
import { STATUSES, DEFAULT_STATUS } from '../lib/constants'

const LS_PROJECT = 'gsm.projectId'
const LS_PROJECT_NAME = 'gsm.projectName'
const LS_MILESTONE = 'gsm.milestoneId'

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

    selectedProjectId: localStorage.getItem(LS_PROJECT) || '',
    selectedProjectName: localStorage.getItem(LS_PROJECT_NAME) || '',
    selectedMilestoneId: localStorage.getItem(LS_MILESTONE) || '',

    loading: { projects: false, milestones: false, issues: false, events: false },
    error: null,
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
    setError(e) {
      this.error = e?.message || String(e)
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
        this.projects = (await api.get('/gitlab/projects', { params: { search } })).data
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
      } catch (e) {
        this.setError(e)
      } finally {
        this.loading.issues = false
      }
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
    async ensureProjectDay(day) {
      if (!this.selectedProjectId) return
      // Make sure the local project (color) exists even after a page reload,
      // where selectProject() may not have run.
      await this.ensureLocalProject(this.selectedProjectId, null)
      const already = this.events.some(
        (e) =>
          e.kind === 'project_day' &&
          String(e.project_id) === String(this.selectedProjectId) &&
          dayjs(e.starts_at).isSame(day, 'day')
      )
      if (already) return
      const start = day.hour(9).minute(0).second(0)
      const end = day.hour(18).minute(0).second(0)
      await this.createEvent({
        title: this.currentLocalProject?.name || this.selectedProjectName,
        kind: 'project_day',
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: true,
        project_id: this.selectedProjectId,
        milestone_id: this.selectedMilestoneId,
      })
    },
  },
})
