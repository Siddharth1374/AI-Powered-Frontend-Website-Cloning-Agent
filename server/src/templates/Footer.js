import { esc } from './helpers.js';

export function render(props = {}) {
  const text = props.text || `© ${new Date().getFullYear()} Company. All rights reserved.`;
  const links = Array.isArray(props.links) ? props.links.slice(0, 8) : [];

  const linkEls = links
    .map(
      (l) =>
        `          <a href="#" className="text-sm text-[var(--color-text)]/60 hover:text-[var(--color-primary)]">{${esc(
          l.text || l
        )}}</a>`
    )
    .join('\n');

  return `export default function Footer() {
  return (
    <footer className="border-t border-black/5 mt-8">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-text)]/60">{${esc(text)}}</p>
        <div className="flex gap-6">
${linkEls || '          <span />'}
        </div>
      </div>
    </footer>
  );
}
`;
}
