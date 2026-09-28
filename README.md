# AI Website Cloning Agent

Paste a public website URL. The agent analyzes the page, generates a responsive
React frontend that recreates it, shows a live local preview, and lets you edit
it with natural-language prompts ("change the primary color to blue", "add a
testimonials section").



## Setup

Requires Node.js 18+ and an API key for Groq or Gemini.

```bash
npm run install:all
cd server && npx playwright install chromium && cd ..
cp server/.env.example server/.env    # Windows: Copy-Item server\.env.example server\.env
```

Edit `server/.env`:

```
LLM_PROVIDER=groq                 # or gemini
GROQ_API_KEY=your_key
GROQ_MODEL=openai/gpt-oss-120b
# GEMINI_API_KEY=your_key
# GEMINI_MODEL=<a current Gemini Flash model>
```

```bash
npm run dev     # API on :8787, dashboard on :5173
```

Open http://localhost:5173, paste a URL, pick a mode, and click the arrow.

## Architecture

`URL → Analysis → Generation → Validation → Preview → Modification`
<img width="1436" height="962" alt="System Architecture Overview" src="https://github.com/user-attachments/assets/3995fa2c-f6d9-4408-8add-3bd698712e3d" />



1. **Analysis:** Playwright loads the page in headless Chromium, reads computed
   styles (colors, fonts, spacing), text, images and navigation, and splits the
   page into visual blocks (header, sections, footer).
2. **Generation:**
   - *High fidelity (default):* the LLM writes one React + Tailwind component
     per block from a compact snapshot of that block's HTML and real styles.
   - *Fast:* one LLM call produces a JSON site spec, and 8 pre-tested
     templates render it.
3. **Validation:** static checks plus a JSX parser, then up to 2 LLM repair
   retries per component, then a plain-text fallback. The in-browser bundler
   (Sandpack) surfaces build and runtime errors, and "Ask AI to fix" patches
   the broken file.
4. **Preview:** live Desktop, Tablet and Mobile views with editable code.
5. **Modification:** the LLM edits either the JSON spec (Fast) or only the
   affected component files (High fidelity). A rewrite that fails validation is
   rejected and the working version is kept.

## Technologies and models

- **Agent:** Node.js, Express (SSE progress streaming), Playwright
- **Generated site:** React, Vite, Tailwind (CDN build)
- **Dashboard:** React, Sandpack (in-browser preview)
- **LLM:** Groq (`openai/gpt-oss-120b`) or Google Gemini, switchable through
  `LLM_PROVIDER` behind one wrapper (`server/src/groq.js`)

## Key implementation decisions

- **Computed styles instead of screenshots:** exact colors, fonts and spacing
  come from the browser, not from a vision model guessing them.
- **Two modes:** Fast is cheap and reliable (one call, templates that can't
  produce broken code). High fidelity is closer to the original but uses about
  one call per section.
- **Layered error handling:** static checks, parser check, retries, fallback
  component, and a user-triggered AI fix. A failure never blocks the whole clone.
- **Targeted edits:** modifications touch only the relevant spec fields or files,
  which keeps changes fast, cheap and low-risk.
- **In-browser preview (Sandpack):** no dev server per clone, and errors show
  up immediately in the UI.
- **Cost control:** retry with backoff on 429/503, capped output sizes, and a
  2-way parallel limit to stay within rate limits.

## Limitations

- Clones a single URL, not linked pages or routes.
- Visual match is close, not pixel-perfect. Animations, hover effects, menus
  and other interactivity are not reproduced, and icons become simple SVGs.
- Responsive behavior is inferred from a desktop-width (1440px) analysis, so
  mobile layouts can differ from the original.
- Content that only loads on scroll, and pages behind a login, may be missed.
- Very long pages are capped at 14 blocks, and dense sections are trimmed.
- Output is JavaScript (`.jsx`) with Tailwind via CDN, not TypeScript or Next.js.
- Sites are stored in memory only and are lost when the server restarts.
- Result quality depends on the LLM. Some sections may fall back to plain text.

## Next steps

Mobile-width analysis, TypeScript/Next.js output, visual diff scoring against a
screenshot, multi-page cloning, and a persistent store.
