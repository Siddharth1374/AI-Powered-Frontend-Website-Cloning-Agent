// Small helpers shared by every template. Templates build *source code
// strings* at generation time (not runtime React) - each generated
// component embeds the scraped content directly as JSX, which keeps
// generated components simple, readable, and free of prop-drilling.

// Safely embed arbitrary text inside a JSX expression container.
export function esc(str) {
  return JSON.stringify(str ?? '');
}

export function safeUrl(u) {
  if (!u || typeof u !== 'string') return null;
  try {
    new URL(u);
    return u;
  } catch {
    return null;
  }
}
