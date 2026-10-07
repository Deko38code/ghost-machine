/* Real API client — token in localStorage, all calls hit the same-origin server. */
const TKEY = "rmt-token";
export const getToken = () => localStorage.getItem(TKEY) || "";
export const setToken = (t) => (t ? localStorage.setItem(TKEY, t) : localStorage.removeItem(TKEY));

export function user() {
  try { return JSON.parse(localStorage.getItem("rmt-user") || "null"); } catch { return null; }
}
export function setUser(u) { u ? localStorage.setItem("rmt-user", JSON.stringify(u)) : localStorage.removeItem("rmt-user"); }

export async function api(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const tok = getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const r = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status} ${path}`);
  return j;
}
export async function upload(path, formData, token = getToken()) {
  const r = await fetch(path, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status} ${path}`);
  return j;
}