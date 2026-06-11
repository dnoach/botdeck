export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (res.status === 401) {
    window.location.href = "/login";
    return null;
  }

  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
