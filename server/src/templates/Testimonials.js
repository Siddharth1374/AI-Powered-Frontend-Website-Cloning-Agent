import { esc } from './helpers.js';

export function render(props = {}) {
  const heading = props.heading || 'What people say';
  const items = Array.isArray(props.items) && props.items.length
    ? props.items.slice(0, 3)
    : [{ quote: 'This product changed how we work.', author: 'A happy customer' }];

  const cards = items
    .map(
      (it) => `        <blockquote className="rounded-[var(--radius)] bg-[var(--color-surface)] p-6">
          <p className="text-[var(--color-text)]/80">“{${esc(it.quote)}}”</p>
          <footer className="mt-4 text-sm font-medium text-[var(--color-text)]">— {${esc(
            it.author
          )}}</footer>
        </blockquote>`
    )
    .join('\n');

  return `export default function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--color-text)]">
        {${esc(heading)}}
      </h2>
      <div className="mt-10 grid md:grid-cols-3 gap-6">
${cards}
      </div>
    </section>
  );
}
`;
}
