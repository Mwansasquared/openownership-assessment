const BASE = import.meta.env.VITE_API_URL || '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Ensure there are no double-slash paths if VITE_API_URL has a trailing slash
  const url = BASE.endsWith('/') && path.startsWith('/') 
    ? `${BASE}${path.slice(1)}` 
    : `${BASE}${path}`

  const res = await fetch(url, {
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      // 'Authorization': `Bearer ${localStorage.getItem('token')}`,
      ...init?.headers 
    },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => request<void>(path, { method: 'DELETE' }),
}
