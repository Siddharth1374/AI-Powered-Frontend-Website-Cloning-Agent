import { groqChat } from './groq.js';
import { KNOWN_SECTION_TYPES, sanitizeSpec } from './spec.js';

const ALLOWED_TYPES = [...KNOWN_SECTION_TYPES, 'custom'];

const SYSTEM_PROMPT = `You edit a website's JSON "site spec" according to a user's natural-language instruction.

You will be given the CURRENT spec and an INSTRUCTION. Return the FULL, UPDATED spec as JSON,
same schema as the input. Change only what the instruction asks for; copy everything else
through unchanged (do not drop sections, do not reorder unless asked, do not "improve" content
that wasn't mentioned).

Section "type" MUST be one of: ${ALLOWED_TYPES.join(', ')}.
Use "custom" ONLY when the instruction describes something no other type could represent
(e.g. a countdown timer, an accordion, a map embed). For "custom" sections, props MUST include
a "description" string that fully describes what the component should do/contain - this is
handed to a code generator, so make it specific.

Examples of instructions and the right kind of change:
- "Change the primary color to blue" -> update theme.colors.primary only.
- "Make the navbar sticky" -> no spec change needed, already sticky by default; leave spec as-is.
- "Add a testimonials section" -> append a { "type": "testimonials", ... } section with
  plausible neutral placeholder content.
- "Replace the hero section with a bakery hero" -> keep type "hero", rewrite its props' text/
  imagery to fit a bakery.
- "Remove the pricing section" -> delete the section whose type is "pricing".

Output ONLY the JSON spec. No prose, no markdown fences.`;

export async function applyModification(currentSpec, instruction) {
  const user = `CURRENT spec:\n${JSON.stringify(currentSpec)}\n\nINSTRUCTION: ${instruction}`;

  const updated = await groqChat({
    system: SYSTEM_PROMPT,
    user,
    json: true,
    maxTokens: 3000,
    temperature: 0.2,
  });

  return sanitizeSpec(updated, { allowCustom: true });
}
