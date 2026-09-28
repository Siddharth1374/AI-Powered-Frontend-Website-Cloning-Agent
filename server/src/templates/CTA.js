import { esc } from './helpers.js';

export function render(props = {}) {
  const heading = props.heading || 'Ready to get started?';
  const subheading = props.subheading || 'Join today and see the difference.';
  const buttonText = props.buttonText || 'Get started';

  return `export default function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-[var(--radius)] bg-[var(--color-primary)] px-8 py-14 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white">{${esc(heading)}}</h2>
        <p className="mt-3 text-white/80">{${esc(subheading)}}</p>
        <button className="mt-6 rounded-[var(--radius)] bg-white text-[var(--color-primary)] px-6 py-3 font-medium">
          {${esc(buttonText)}}
        </button>
      </div>
    </section>
  );
}
`;
}
