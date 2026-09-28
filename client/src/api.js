const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export function streamClone(url, mode, { onProgress, onDone, onError }) {
  const es = new EventSource(`${BASE}/api/clone/stream?url=${encodeURIComponent(url)}&mode=${mode}`);
  es.addEventListener('progress', (e) => onProgress(JSON.parse(e.data)));
  es.addEventListener('done', (e) => {
    onDone(JSON.parse(e.data));
    es.close();
  });
  es.addEventListener('error', (e) => {
    // EventSource fires a generic 'error' on network issues too; only
    // surface it if the server actually sent a payload.
    if (e.data) onError(JSON.parse(e.data));
    es.close();
  });
  return () => es.close();
}

export async function modifySite(siteId, instruction) {
  const res = await fetch(`${BASE}/api/sites/${siteId}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Modification failed');
  return res.json();
}

export async function fixFile(siteId, path, errorMessage) {
  const res = await fetch(`${BASE}/api/sites/${siteId}/fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, errorMessage }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Fix failed');
  return res.json();
}
