import { esc } from './helpers.js';

export function render(props = {}) {
  const heading = props.heading || 'Features';
  const items = Array.isArray(props.items) && props.items.length
    ? props.items.slice(0, 6)
    : [
        { title: 'Fast', description: 'Built for speed from the ground up.' },
        { title: 'Reliable', description: 'Consistent, predictable behavior.' },
        { title: 'Simple', description: 'Nothing to learn, nothing to configure.' },
      ];

  const cards = items
    .map(
      (it) => `        <div className="rounded-[var(--radius)] border border-black/5 bg-[var(--color-surface)] p-6">
          <div className="h-10 w-10 rounded-[var(--radius)] bg-[var(--color-primary)]/10 mb-4" />
          <h3 className="font-semibold text-[var(--color-text)]">{${esc(it.title)}}</h3>
          <p className="mt-2 text-sm text-[var(--color-text)]/70">{${esc(it.description)}}</p>
        </div>`
    )
    .join('\n');

  return `export default function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--color-text)]">
        {${esc(heading)}}
      </h2>
      <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-6">
${cards}
      </div>
    </section>
  );
}
`;
}
