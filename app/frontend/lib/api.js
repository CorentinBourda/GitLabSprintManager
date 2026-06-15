import axios from 'axios'

const csrf = document.querySelector('meta[name="csrf-token"]')?.content

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
  },
})

// Normalize backend errors to a readable message.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'Une erreur est survenue'
    return Promise.reject(new Error(message))
  }
)

export default api
