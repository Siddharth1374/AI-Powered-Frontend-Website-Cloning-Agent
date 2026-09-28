import { esc, safeUrl } from './helpers.js';

export function render(props = {}) {
  const heading = props.heading || 'A better way to work';
  const subheading = props.subheading || 'Describe your product in one clear sentence.';
  const primaryCta = props.primaryCta || 'Get started';
  const secondaryCta = props.secondaryCta || 'Learn more';
  const image = safeUrl(props.image);

  return `export default function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
      <div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--color-text)]">
          {${esc(heading)}}
        </h1>
        <p className="mt-6 text-lg text-[var(--color-text)]/70">{${esc(subheading)}}</p>
        <div className="mt-8 flex gap-4">
          <button className="rounded-[var(--radius)] bg-[var(--color-primary)] text-white px-6 py-3 font-medium">
            {${esc(primaryCta)}}
          </button>
          <button className="rounded-[var(--radius)] border border-black/10 px-6 py-3 font-medium text-[var(--color-text)]">
            {${esc(secondaryCta)}}
          </button>
        </div>
      </div>
      <div className="aspect-square max-w-sm justify-self-center rounded-full bg-[var(--color-surface)] flex items-center justify-center overflow-hidden">
        ${
          image
            ? `<img src={${esc(image)}} alt="" className="w-full h-full object-cover" />`
            : `<span className="text-[var(--color-text)]/30 text-sm">Hero image</span>`
        }
      </div>
    </section>
  );
}
`;
}
