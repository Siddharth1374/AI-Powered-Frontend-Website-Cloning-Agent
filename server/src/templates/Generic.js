import { esc, safeUrl } from './helpers.js';

// Fallback for any section the spec extractor could not confidently map to
// a known pattern. Still fully deterministic (no extra LLM call needed),
// which keeps the common case cheap; genuinely novel sections are instead
// handled by customComponent.js at the caller's discretion.
export function render(props = {}) {
  const heading = props.heading || null;
  const paragraph = props.paragraph || null;
  const buttons = Array.isArray(props.buttons) ? props.buttons.slice(0, 3) : [];
  const images = (Array.isArray(props.images) ? props.images : [])
    .map(safeUrl)
    .filter(Boolean)
    .slice(0, 3);

  const buttonEls = buttons
    .map(
      (b) =>
        `          <button className="rounded-[var(--radius)] border border-black/10 px-5 py-2.5 font-medium">{${esc(
          b
        )}}</button>`
    )
    .join('\n');

  const imageEls = images
    .map(
      (src) =>
        `          <img src={${esc(src)}} alt="" className="rounded-[var(--radius)] w-full object-cover" />`
    )
    .join('\n');

  return `export default function GenericSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      ${heading ? `<h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">{${esc(heading)}}</h2>` : ''}
      ${paragraph ? `<p className="mt-4 text-[var(--color-text)]/70 max-w-3xl">{${esc(paragraph)}}</p>` : ''}
      ${buttonEls ? `<div className="mt-6 flex gap-3">\n${buttonEls}\n          </div>` : ''}
      ${imageEls ? `<div className="mt-8 grid sm:grid-cols-2 md:grid-cols-3 gap-4">\n${imageEls}\n          </div>` : ''}
    </section>
  );
}
`;
}
