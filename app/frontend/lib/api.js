import axios from 'axios'

const csrf = document.querySelector('meta[name="csrf-token"]')?.content

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
  },
})

// Normalize backend errors to a readable message, keeping the HTTP status so
// callers can react differently to "not found" vs. a real upstream failure.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status || null
    const message =
      error.response?.data?.error ||
      error.message ||
      'Une erreur est survenue'
    const err = new Error(message)
    err.status = status
    return Promise.reject(err)
  }
)

export default api
