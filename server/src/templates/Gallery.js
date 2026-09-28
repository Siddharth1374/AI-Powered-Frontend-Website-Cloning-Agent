import { esc, safeUrl } from './helpers.js';

export function render(props = {}) {
  const heading = props.heading || 'Gallery';
  const images = (Array.isArray(props.images) ? props.images : [])
    .map(safeUrl)
    .filter(Boolean)
    .slice(0, 6);

  const tiles = (images.length ? images : [null, null, null])
    .map(
      (src) => `        <div className="aspect-square rounded-[var(--radius)] bg-[var(--color-surface)] overflow-hidden">
          ${
            src
              ? `<img src={${esc(src)}} alt="" className="w-full h-full object-cover" />`
              : `<div className="w-full h-full" />`
          }
        </div>`
    )
    .join('\n');

  return `export default function Gallery() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--color-text)]">
        {${esc(heading)}}
      </h2>
      <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-4">
${tiles}
      </div>
    </section>
  );
}
`;
}
