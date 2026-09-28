import { esc } from './helpers.js';

export function render(props = {}) {
  const brand = props.brand || 'Brand';
  const links = Array.isArray(props.links) ? props.links.slice(0, 8) : [];
  const cta = props.cta || null;

  const linkEls = links
    .map(
      (l) =>
        `          <a href="#" className="text-sm font-medium text-[var(--color-text)]/80 hover:text-[var(--color-primary)] transition-colors">{${esc(
          l.text || l
        )}}</a>`
    )
    .join('\n');

  return `export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur bg-[var(--color-background)]/80 border-b border-black/5">
      <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-[var(--color-primary)]">{${esc(brand)}}</span>
        <div className="hidden md:flex items-center gap-6">
${linkEls || '          <span />'}
        </div>
        ${cta ? `<button className="rounded-[var(--radius)] border border-white/20 bg-[var(--color-primary)] text-white text-sm font-medium px-4 py-2">{${esc(cta)}}</button>` : '<span />'}
      </nav>
    </header>
  );
}
`;
}
