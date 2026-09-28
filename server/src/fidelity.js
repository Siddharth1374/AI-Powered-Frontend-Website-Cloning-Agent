import { groqChat } from './groq.js';
import { renderProject } from './renderer.js';
import { validateComponentCode, generateCustomComponent } from './customComponent.js';

let babel = null;
try {
  babel = await import('@babel/parser');
} catch {
  /* optional: without it we fall back to the lightweight static checks */
}

const SYSTEM = `You convert a simplified DOM snapshot of ONE page section into a single React component
that reproduces it as closely as possible.

Snapshot format:
- Each tag has an inline style="" containing only the computed CSS that differs from its parent
  (colors, fonts, padding, margin, border, radius, shadow, display/flex/grid, gap, gradients).
- h="N" on the root is its rendered height in px; <img> has src, w, h; <svg w h color/> is an icon.

Rules:
- Output ONLY raw .jsx source. No markdown fences, no commentary.
- Exactly one default export function with the exact name you are given.
- Only import from "react" if you need hooks. No other imports, no fetch, no external CSS.
- Reproduce layout, colors, gradients, fonts, spacing, borders, radii and shadows faithfully.
  Use Tailwind classes for layout and inline style={{...}} objects for exact values
  (copy colors and gradients verbatim from the snapshot).
- Keep ALL text verbatim. Keep every <img> src exactly as given.
- Icons (<svg .../>): render a small inline <svg> (simple shape or glyph) of that size and color.
- The outermost element must be full-width and carry the section's own background.
- Make it responsive: keep the desktop look, but stack columns on small screens (md: prefixes).
- Links use href="#". Buttons do nothing.`;

function stripFences(code) {
  return code.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
}

function findProblems(code, name) {
  const problems = validateComponentCode(code, name);
  if (!problems.length && babel) {
    try {
      babel.parse(code, { sourceType: 'module', plugins: ['jsx'] });
    } catch (e) {
      problems.push(`Syntax error: ${e.message}`);
    }
  }
  return problems;
}

async function generateBlock({ name, block }) {
  const user = `Component name: ${name}\nSection tag: <${block.tag}>, height ≈ ${block.height}px\n\nSnapshot:\n${block.html}`;
  let code = stripFences(await groqChat({ system: SYSTEM, user, maxTokens: 4000, temperature: 0.1 }));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const problems = findProblems(code, name);
    if (!problems.length) return code;
    code = stripFences(
      await groqChat({
        system: SYSTEM,
        user: `${user}\n\nYour previous attempt had problems:\n- ${problems.join('\n- ')}\n\nPrevious code:\n${code}\n\nReturn the full corrected component.`,
        maxTokens: 4000,
        temperature: 0.1,
      })
    );
  }
  return findProblems(code, name).length ? null : code;
}

function fallbackComponent(name, block) {
  const text = block.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  return `export default function ${name}() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <p>{${JSON.stringify(text)}}</p>
    </section>
  );
}
`;
}

function toHex(rgb) {
  const m = String(rgb || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

const GENERIC_FONTS = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'arial', 'helvetica', 'helvetica neue', 'times new roman', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'roboto', 'georgia', 'courier new', 'cursive', 'emoji']);

function googleFontFamilies(...stacks) {
  const out = [];
  for (const stack of stacks) {
    for (const raw of String(stack || '').split(',')) {
      const f = raw.trim().replace(/^["']|["']$/g, '');
      if (f && !GENERIC_FONTS.has(f.toLowerCase()) && !out.includes(f)) out.push(f);
    }
  }
  return out.slice(0, 3);
}

/** Build the minimal spec (title + theme) without an extra LLM call. */
export function buildFidelitySpec(url, analysis) {
  const t = analysis.theme || {};
  return {
    meta: { title: analysis.title || url, description: analysis.description || '' },
    theme: {
      colors: {
        primary: '#4f46e5',
        secondary: '#0f172a',
        background: toHex(t.bodyBackground) || toHex(t.rootBackground) || '#ffffff',
        surface: '#f8fafc',
        text: toHex(t.bodyTextColor) || '#0f172a',
      },
      headingFont: t.headingFont || 'Inter, sans-serif',
      bodyFont: t.bodyFont || 'Inter, sans-serif',
      borderRadius: 'md',
    },
    sections: [],
  };
}

export async function renderFidelityProject(url, analysis, onProgress = () => {}) {
  const spec = buildFidelitySpec(url, analysis);
  const blocks = analysis.blocks || [];
  if (!blocks.length) throw new Error('No visible page blocks were captured for high-fidelity mode.');

  // Reuse the standard scaffold (index.html, main.jsx, index.css, package.json...).
  const { files } = await renderProject(spec);

  const names = blocks.map((_, i) => `Block${i + 1}`);
  const results = new Array(blocks.length);
  let next = 0;
  let done = 0;

  // Small worker pool (2 at a time) - fast, but gentle on API rate limits.
  async function worker() {
    while (next < blocks.length) {
      const i = next++;
      let code = null;
      try {
        code = await generateBlock({ name: names[i], block: blocks[i] });
      } catch (err) {
        console.warn(`Block ${i + 1} failed: ${err.message}`);
      }
      results[i] = code || fallbackComponent(names[i], blocks[i]);
      done += 1;
      onProgress(done, blocks.length, !code);
    }
  }
  await Promise.all([worker(), worker()]);

  names.forEach((n, i) => {
    files[`src/components/${n}.jsx`] = { code: results[i] };
  });

  files['src/App.jsx'] = {
    code: `${names.map((n) => `import ${n} from './components/${n}';`).join('\n')}

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
${names.map((n) => `      <${n} />`).join('\n')}
    </div>
  );
}
`,
  };

  // Load the site's real web fonts (Google Fonts) so typography matches.
  const families = googleFontFamilies(spec.theme.headingFont, spec.theme.bodyFont);
  if (families.length) {
    const href = 'https://fonts.googleapis.com/css2?' +
      families.map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800`).join('&') +
      '&display=swap';
    files['index.html'].code = files['index.html'].code.replace(
      '</head>',
      `    <link rel="stylesheet" href="${href}" />\n  </head>`
    );
  }

  spec.sections = names.map((n) => ({ type: 'fidelity', props: { name: n } }));
  return { spec, files };
}

/**
 * Modification in high-fidelity mode: the site is raw components, so we
 * (1) ask the model which files an instruction touches (or whether it
 * wants a brand-new section), then (2) rewrite only those files.
 */
export async function modifyFidelityFiles(files, instruction) {
  const comps = Object.keys(files).filter((p) => p.startsWith('src/components/'));
  const summary = comps
    .map((p) => `${p}: ${files[p].code.replace(/\s+/g, ' ').slice(0, 260)}`)
    .join('\n');

  const pick = await groqChat({
    system: `You decide which React component files must change to satisfy an instruction.
Return JSON: {"files": [paths], "newSection": null | {"description": string, "after": path|null}}.
- "files": at most 4 existing paths from the list. For global changes (e.g. a color), choose every file that uses it.
- "newSection": only when the instruction asks to ADD a section that doesn't exist.`,
    user: `Files:\n${summary}\n\nInstruction: ${instruction}`,
    json: true,
    maxTokens: 500,
  });

  const out = { ...files };
  const targets = (pick.files || []).filter((p) => out[p]).slice(0, 4);

  for (const path of targets) {
    const name = path.split('/').pop().replace('.jsx', '');
    let code = stripFences(
      await groqChat({
        system: `You edit one React component. Apply ONLY the requested change; keep everything else identical.
Output ONLY the full updated .jsx source (no fences). Keep the default export name "${name}". Only import from "react".`,
        user: `Instruction: ${instruction}\n\nCurrent code:\n${out[path].code}`,
        maxTokens: 4000,
        temperature: 0.1,
      })
    );
    if (findProblems(code, name).length) continue; // keep the working version rather than break it
    out[path] = { code };
  }

  if (pick.newSection?.description) {
    const name = `Custom${Date.now() % 100000}`;
    const code = await generateCustomComponent({
      componentName: name,
      description: pick.newSection.description,
      theme: {},
    });
    out[`src/components/${name}.jsx`] = { code };
    let app = out['src/App.jsx'].code;
    const tag = `      <${name} />`;
    const after = pick.newSection.after ? pick.newSection.after.split('/').pop().replace('.jsx', '') : null;
    app = `import ${name} from './components/${name}';\n` + app;
    app =
      after && app.includes(`<${after} />`)
        ? app.replace(`<${after} />`, `<${after} />\n${tag}`)
        : app.replace('    </div>\n  );', `${tag}\n    </div>\n  );`);
    out['src/App.jsx'] = { code: app };
  }

  if (!targets.length && !pick.newSection?.description) {
    throw new Error('Could not tell which section to change. Try naming the section (e.g. "in the hero section…").');
  }
  return out;
}
