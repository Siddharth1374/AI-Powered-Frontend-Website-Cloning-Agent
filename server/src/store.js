// Simple in-memory store, intentionally not a database: this is a local
// 48-hour MVP with no auth and no persistence requirement. Swapping this
// for SQLite/Redis later only touches this one file.
const sites = new Map();

export function createSite(id, data) {
  sites.set(id, { id, createdAt: Date.now(), history: [], ...data });
  return sites.get(id);
}

export function getSite(id) {
  return sites.get(id);
}

export function updateSite(id, patch) {
  const site = sites.get(id);
  if (!site) return null;
  Object.assign(site, patch);
  sites.set(id, site);
  return site;
}

export function pushHistory(id, entry) {
  const site = sites.get(id);
  if (!site) return null;
  site.history.push({ at: Date.now(), ...entry });
  return site;
}

export function listSites() {
  return Array.from(sites.values()).map(({ id, url, meta, createdAt }) => ({
    id,
    url,
    title: meta?.title,
    createdAt,
  }));
}
