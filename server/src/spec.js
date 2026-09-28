import { groqChat } from './groq.js';

// The fixed set of section "types" our template renderer knows how to draw.
// Keeping this list closed (instead of letting the model invent arbitrary
// types) is what makes code generation deterministic and cheap: most real
// marketing/landing sites are >90% covered by these eight patterns.
export const KNOWN_SECTION_TYPES = [
  'navbar',
  'hero',
  'features',
  'gallery',
  'testimonials',
  'pricing',
  'cta',
  'footer',
];

const SYSTEM_PROMPT = `You are a senior frontend engineer converting a scraped website analysis into a
strict JSON "site spec" that a template renderer will turn into React + Tailwind code.

Rules:
- Output ONLY valid JSON matching the schema below. No prose, no markdown fences.
- theme.colors values MUST be hex codes (convert any rgb()/rgba() you see).
- "type" for every section in "sections" MUST be one of: ${KNOWN_SECTION_TYPES.join(', ')}, or "generic" if nothing fits.
- Prefer "generic" over forcing a bad fit - a custom renderer handles it.
- Keep arrays short: max 6 features, 6 gallery images, 3 testimonials, 4 pricing tiers, 8 nav links.
- Use analysis.navLinks for navbar links and analysis.navCta for navbar.props.cta. Use analysis.topImages (in page order) for hero.image and gallery images; the first is usually the hero image.
- Copy real text from the analysis (headings, paragraphs, button labels) verbatim into props instead of paraphrasing it.
- Never invent facts you weren't given (e.g. don't make up prices if none were scraped) - use reasonable
  neutral placeholders instead ("Contact us", "Learn more") when data is missing.

Schema:
{
  "meta": { "title": string, "description": string },
  "theme": {
    "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "surface": "#hex", "text": "#hex" },
    "headingFont": string,
    "bodyFont": string,
    "borderRadius": "none" | "sm" | "md" | "lg" | "full"
  },
  "sections": [
    { "type": "navbar", "props": { "brand": string, "links": [{ "text": string, "href": string }], "cta": string|null } },
    { "type": "hero", "props": { "heading": string, "subheading": string, "primaryCta": string, "secondaryCta": string, "image": string|null } },
    { "type": "features", "props": { "heading": string, "items": [{ "title": string, "description": string }] } },
    { "type": "gallery", "props": { "heading": string, "images": [string] } },
    { "type": "testimonials", "props": { "heading": string, "items": [{ "quote": string, "author": string }] } },
    { "type": "pricing", "props": { "heading": string, "tiers": [{ "name": string, "price": string, "features": [string] }] } },
    { "type": "cta", "props": { "heading": string, "subheading": string, "buttonText": string } },
    { "type": "footer", "props": { "text": string, "links": [{ "text": string, "href": string }] } },
    { "type": "generic", "props": { "heading": string|null, "paragraph": string|null, "buttons": [string], "images": [string] } }
  ]
}`;

export async function buildSiteSpec(url, analysis) {
  const user = `Website URL: ${url}\n\nScraped analysis (truncated JSON):\n${JSON.stringify(
    analysis
  ).slice(0, 20000)}`;

  const spec = await groqChat({
    system: SYSTEM_PROMPT,
    user,
    json: true,
    maxTokens: 3000,
    temperature: 0.15,
  });

  return sanitizeSpec(spec);
}

// Defensive normalization so a slightly-off LLM response can't crash the
// deterministic renderer downstream (missing arrays, unknown section type, etc).
// `allowCustom` is used by the modification flow, which is allowed to
// introduce a "custom" section type (rendered by a one-off LLM-written
// component) for structures no template covers - the initial cloning pass
// never produces "custom" sections, keeping the common path template-only.
export function sanitizeSpec(spec, { allowCustom = false } = {}) {
  const s = { ...spec };
  s.meta = s.meta || { title: 'Untitled site', description: '' };
  s.theme = {
    colors: {
      primary: '#4f46e5',
      secondary: '#0f172a',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      ...(s.theme?.colors || {}),
    },
    headingFont: s.theme?.headingFont || 'Inter, sans-serif',
    bodyFont: s.theme?.bodyFont || 'Inter, sans-serif',
    borderRadius: s.theme?.borderRadius || 'md',
  };
  const allowedTypes = allowCustom ? [...KNOWN_SECTION_TYPES, 'custom'] : KNOWN_SECTION_TYPES;
  s.sections = Array.isArray(s.sections) ? s.sections : [];
  s.sections = s.sections
    .filter((sec) => sec && sec.type)
    .map((sec) => ({
      type: allowedTypes.includes(sec.type) ? sec.type : 'generic',
      props: sec.props || {},
    }));

  if (!s.sections.length) {
    s.sections = [
      { type: 'navbar', props: { brand: s.meta.title, links: [] } },
      {
        type: 'hero',
        props: {
          heading: s.meta.title,
          subheading: s.meta.description,
          primaryCta: 'Get started',
          secondaryCta: 'Learn more',
          image: null,
        },
      },
      { type: 'footer', props: { text: `© ${s.meta.title}`, links: [] } },
    ];
  }

  return s;
}
