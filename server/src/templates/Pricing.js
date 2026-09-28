import { esc } from './helpers.js';

export function render(props = {}) {
  const heading = props.heading || 'Pricing';
  const tiers = Array.isArray(props.tiers) && props.tiers.length
    ? props.tiers.slice(0, 4)
    : [{ name: 'Standard', price: 'Contact us', features: ['Everything you need'] }];

  const cards = tiers
    .map((t, i) => {
      const features = (Array.isArray(t.features) ? t.features : [])
        .slice(0, 6)
        .map(
          (f) =>
            `            <li className="flex items-center gap-2"><span className="text-[var(--color-primary)]">✓</span>{${esc(
              f
            )}}</li>`
        )
        .join('\n');
      const highlighted = i === 1;
      return `        <div className="rounded-[var(--radius)] border ${
        highlighted
          ? 'border-[var(--color-primary)] shadow-lg'
          : 'border-black/10'
      } p-6 flex flex-col">
          <h3 className="font-semibold text-[var(--color-text)]">{${esc(t.name)}}</h3>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text)]">{${esc(t.price)}}</p>
          <ul className="mt-6 space-y-2 text-sm text-[var(--color-text)]/80 flex-1">
${features || '            <li>Contact us for details</li>'}
          </ul>
          <button className="mt-6 rounded-[var(--radius)] bg-[var(--color-primary)] text-white px-4 py-2 font-medium">
            Choose plan
          </button>
        </div>`;
    })
    .join('\n');

  return `export default function Pricing() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--color-text)]">
        {${esc(heading)}}
      </h2>
      <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-${tiers.length > 1 ? Math.min(tiers.length, 4) : 1} gap-6">
${cards}
      </div>
    </section>
  );
}
`;
}
