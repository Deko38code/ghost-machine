/* live data — everything through the real server API */
import { api } from "../lib/api.js";

export async function search(f = {}) {
  const p = new URLSearchParams({ q: f.q || "", cat: f.cat || "", state: f.state || "", max: f.max || "", sort: f.sort || "", page: f.page || 1 });
  return api("GET", `/api/trailers?${p}`);
}

export async function stats() {
  return api("GET", "/api/trailers/meta");
}

export async function getListing(id) {
  return api("GET", `/api/trailers/${id}`);
}

export function featured(n = 8) { return search({ sort: "new", page: 1 }).then((d) => d.rows.filter((r) => r.img).slice(0, n)); }
