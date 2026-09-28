import { TEMPLATES } from './templates/index.js';
import { generateCustomComponent } from './customComponent.js';

/**
 * Turn a validated site spec into a full set of React source files.
 *
 * This is the "Generate React/Next.js Frontend" step, but deliberately NOT
 * implemented as "ask an LLM to write the whole app". Instead:
 *   - Known section types (navbar/hero/features/...) are rendered by pure,
 *     hand-written, already-tested template functions.
 *   - Only sections explicitly marked "custom" (added during a
 *     modification, see modify.js) trigger a single scoped LLM call.
 *
 * Why: templates can't have syntax errors, don't hallucinate broken JSX,
 * are instant and free to render, and are trivially re-renderable when a
 * modification only changes props (color, text, an item in an array).
 * That covers "Error handling" and "Cost awareness" from the brief at the
 * architecture level, not just with a retry loop bolted on afterwards.
 */
export async function renderProject(spec) {
  const files = {};
  const componentImports = [];
  const componentTags = [];

  let i = 0;
  for (const section of spec.sections) {
    i += 1;
    const key = section.type;
    const template = TEMPLATES[key];

    let code;
    let componentName;

    if (template) {
      componentName = `${template.componentName}${i}`;
      code = template.render(section.props).replace(
        new RegExp(`export default function ${template.componentName}`),
        `export default function ${componentName}`
      );
    } else {
      // section.type === 'custom' (only reachable via a modification, see modify.js)
      componentName = `Custom${i}`;
      code = await generateCustomComponent({
        componentName,
        description: section.props?.description || 'A generic content section.',
        theme: spec.theme,
      });
    }

    const fileName = `${componentName}.jsx`;
    files[`src/components/${fileName}`] = { code };
    componentImports.push(`import ${componentName} from './components/${fileName.replace('.jsx', '')}';`);
    componentTags.push(`      <${componentName} />`);
  }

  files['src/App.jsx'] = {
    code: `${componentImports.join('\n')}

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
${componentTags.join('\n')}
    </div>
  );
}
`,
  };

  files['src/index.css'] = { code: buildThemeCss(spec.theme) };

  files['src/main.jsx'] = {
    code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  };

  files['index.html'] = {
    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(spec.meta?.title || 'Cloned site')}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- Tailwind's CDN build: chosen deliberately (see README) so the
         generated project needs zero build-tool setup (no postcss.config,
         no tailwind.config) to run either in this app's live preview or
         standalone via "npm run dev". Swap for a compiled Tailwind setup
         before shipping to production. -->
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  };

  // Make the generated output a fully standalone, independently runnable
  // Vite + React project - not just something this dashboard can preview.
  files['package.json'] = {
    code: JSON.stringify(
      {
        name: slugify(spec.meta?.title || 'cloned-site'),
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: { '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.1' },
      },
      null,
      2
    ) + '\n',
  };

  files['vite.config.js'] = {
    code: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
  };

  return { files, componentCount: i };
}

function slugify(str) {
  return (
    String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'cloned-site'
  );
}

const RADIUS_MAP = { none: '0px', sm: '6px', md: '12px', lg: '20px', full: '9999px' };

function buildThemeCss(theme) {
  const c = theme.colors;
  const radius = RADIUS_MAP[theme.borderRadius] || RADIUS_MAP.md;
  return `:root {
  --color-primary: ${c.primary};
  --color-secondary: ${c.secondary};
  --color-background: ${c.background};
  --color-surface: ${c.surface};
  --color-text: ${c.text};
  --radius: ${radius};
  --font-heading: ${theme.headingFont};
  --font-body: ${theme.bodyFont};
}

body {
  font-family: var(--font-body);
}
h1, h2, h3, h4 {
  font-family: var(--font-heading);
}
`;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}
