// Route GitLab-hosted (auth-protected) avatars through our backend proxy so the
// browser can display them. External avatars (e.g. Gravatar) load directly.
export function avatarSrc(url, baseUrl) {
  if (!url) return null
  try {
    const u = new URL(url)
    const base = baseUrl ? new URL(baseUrl) : null
    if (base && u.host === base.host) {
      return `/api/gitlab/avatar?url=${encodeURIComponent(url)}`
    }
  } catch (_) {
    /* malformed url — fall through */
  }
  return url
}

// Format a number of seconds the GitLab way (1 day = 8 h). e.g. "2j 3h", "30min".
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0h'
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}min`
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 8)
  const hours = totalHours - days * 8
  const mins = totalMinutes - totalHours * 60
  const parts = []
  if (days) parts.push(`${days}j`)
  if (hours) parts.push(`${hours}h`)
  if (!days && mins) parts.push(`${mins}min`)
  return parts.join(' ') || '0h'
}

export function initials(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
