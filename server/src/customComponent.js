import { groqChat } from './groq.js';

/**
 * Escape hatch used only when a request genuinely doesn't fit any of the
 * fixed templates (e.g. "add a countdown timer section", "add a FAQ
 * accordion"). Every other case - the vast majority - is handled by the
 * deterministic template renderer, which is why this is a small, rarely
 * called function rather than the default code path. Keeping the prompt
 * tightly constrained (single file, Tailwind only, no new deps) is what
 * keeps this safe to drop straight into the generated project.
 */
export async function generateCustomComponent({ componentName, description, theme }) {
  const system = `You write a single self-contained React functional component.
Hard rules:
- Output ONLY the raw .jsx source code. No markdown fences, no commentary.
- Exactly one default export, named "${componentName}".
- Only import from "react" if you need hooks (useState/useEffect). No other imports - no icon
  libraries, no UI kits, no CSS files, no fetch/network calls, no external images beyond the
  ones explicitly given to you.
- Style using Tailwind utility classes only.
- Use these CSS variables for theme consistency: var(--color-primary), var(--color-secondary),
  var(--color-background), var(--color-surface), var(--color-text), var(--radius).
- Wrap the whole component in a <section className="mx-auto max-w-6xl px-6 py-16"> ... </section>.
- Keep it visually consistent with a clean modern marketing site.`;

  const user = `Component name: ${componentName}
Theme: ${JSON.stringify(theme)}
What this section should do/contain: ${description}`;

  let code = stripFences(
    await groqChat({ system, user, json: false, maxTokens: 1500, temperature: 0.3 })
  );

  // Lightweight self-healing loop (see README "Error handling"): most
  // "generated code doesn't compile" failures for a small, constrained
  // component are things like a missing default export or an accidental
  // import - cheap to detect statically and cheap to ask the model to fix
  // without a full sandbox build round-trip.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const problems = validateComponentCode(code, componentName);
    if (!problems.length) break;
    code = stripFences(
      await groqChat({
        system,
        user: `${user}\n\nYour previous attempt had problems:\n- ${problems.join(
          '\n- '
        )}\n\nHere is your previous code:\n${code}\n\nFix it and return the full corrected component.`,
        json: false,
        maxTokens: 1500,
        temperature: 0.2,
      })
    );
  }

  return code;
}

/** Fast static checks - not a real compiler, just enough to catch the
 * common ways a constrained LLM-written component breaks. */
export function validateComponentCode(code, componentName) {
  const problems = [];
  if (!new RegExp(`export default function ${componentName}\\b`).test(code)) {
    problems.push(`Must contain "export default function ${componentName}(...)".`);
  }
  const badImport = code.match(/^import .* from ['"](?!react)([^'"]+)['"]/m);
  if (badImport) {
    problems.push(`Disallowed import "${badImport[1]}" - only "react" may be imported.`);
  }
  const opens = (code.match(/{/g) || []).length;
  const closes = (code.match(/}/g) || []).length;
  if (opens !== closes) {
    problems.push('Unbalanced curly braces.');
  }
  const opensParen = (code.match(/\(/g) || []).length;
  const closesParen = (code.match(/\)/g) || []).length;
  if (opensParen !== closesParen) {
    problems.push('Unbalanced parentheses.');
  }
  return problems;
}

function stripFences(code) {
  return code
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/i, '')
    .trim();
}
