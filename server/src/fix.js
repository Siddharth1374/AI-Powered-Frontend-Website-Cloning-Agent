import { groqChat } from './groq.js';

/**
 * Client-side preview (Sandpack) runs generated code in a real in-browser
 * bundler, so it surfaces real build/runtime errors ("Run & Validate" in
 * the brief). Rather than rebuilding a server-side compiler, we let the
 * client report the error text + path back here and ask Groq to patch
 * just that one file. This is the same idea as the customComponent retry
 * loop, generalized to any file so any template output that was hand-
 * edited afterwards, or a custom LLM component, can be self-corrected.
 */
export async function fixFile({ path, code, errorMessage }) {
  const system = `You fix a single broken React component file so it compiles and runs.
Rules:
- Output ONLY the corrected raw source code for this one file. No markdown fences, no commentary.
- Preserve the component's default export name and overall structure/content as much as possible.
- Only import from "react" if needed. No new dependencies.
- Fix precisely the reported error; do not do an unrelated rewrite.`;

  const user = `File: ${path}

Current code:
${code}

Build/runtime error reported by the preview:
${errorMessage}`;

  const fixed = await groqChat({ system, user, json: false, maxTokens: 1500, temperature: 0.1 });
  return fixed
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/i, '')
    .trim();
}
