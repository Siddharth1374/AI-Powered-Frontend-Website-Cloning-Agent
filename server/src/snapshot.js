/**
 * Runs INSIDE the browser page (via page.evaluate) - must stay fully
 * self-contained: no imports, no references to outer variables.
 *
 * Splits the page into visual "blocks" (header, each section, footer) and
 * serializes each into a compact HTML-like snapshot where every element
 * carries only the computed styles that DIFFER from its parent. That keeps
 * the snapshot small enough for an LLM while preserving exact colors,
 * fonts, spacing, gradients, flex/grid layout and image URLs.
 */
export function collectBlocks() {
  const SKIP = new Set(['script', 'style', 'noscript', 'link', 'meta', 'template']);
  const INHERITED = ['color', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform'];
  const OWN = ['backgroundColor', 'backgroundImage', 'padding', 'margin', 'border', 'borderRadius', 'boxShadow', 'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap', 'gridTemplateColumns', 'maxWidth', 'opacity', 'position'];
  const EMPTY = new Set(['none', 'normal', 'auto', '0px', 'rgba(0, 0, 0, 0)', 'baseline', 'row', 'static', 'visible', '1', 'start', '0px 0px', 'stretch']);
  const DISPLAY_KEEP = new Set(['flex', 'grid', 'inline-flex', 'inline-grid', 'inline-block']);
  const POSITION_KEEP = new Set(['fixed', 'sticky', 'absolute']);

  const kebab = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  const esc = (s) => String(s).replace(/"/g, '&quot;');

  function visibleKids(el) {
    return Array.from(el.children).filter((k) => {
      if (SKIP.has(k.tagName.toLowerCase())) return false;
      const cs = getComputedStyle(k);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      return k.getBoundingClientRect().height > 20;
    });
  }

  function snap(el, depth, parentCs, ctx) {
    if (ctx.n >= 170 || depth > 9) return '';
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return '';
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return '';
    ctx.n += 1;
    const r = el.getBoundingClientRect();

    if (tag === 'svg') {
      return `<svg w="${Math.round(r.width)}" h="${Math.round(r.height)}" color="${cs.color}"/>`;
    }

    const style = [];
    for (const p of INHERITED) {
      const v = cs[p];
      if (v && (!parentCs || v !== parentCs[p])) style.push(`${kebab(p)}:${String(v).slice(0, 60)}`);
    }
    for (const p of OWN) {
      const v = cs[p];
      if (!v || EMPTY.has(v)) continue;
      if (p === 'display' && !DISPLAY_KEEP.has(v)) continue;
      if (p === 'position' && !POSITION_KEEP.has(v)) continue;
      if (p === 'border' && v.startsWith('0px')) continue;
      if (p === 'gap' && v.startsWith('normal')) continue;
      style.push(`${kebab(p)}:${String(v).slice(0, 200)}`);
    }
    const styleAttr = style.length ? ` style="${esc(style.join(';'))}"` : '';

    let attrs = '';
    if (tag === 'img') {
      const src = el.currentSrc || el.src || '';
      return `<img src="${esc(src)}" alt="${esc((el.alt || '').slice(0, 60))}" w="${Math.round(r.width)}" h="${Math.round(r.height)}"${styleAttr}/>`;
    }
    if (tag === 'a') attrs += ` href="${esc(el.getAttribute('href') || '#')}"`;
    if (depth === 0) attrs += ` h="${Math.round(r.height)}"`;

    let inner = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        const t = node.textContent.replace(/\s+/g, ' ').trim();
        if (t) inner += t;
      } else if (node.nodeType === 1) {
        inner += snap(node, depth + 1, cs, ctx);
      }
    }
    if (!inner && !styleAttr) return '';
    return `<${tag}${attrs}${styleAttr}>${inner}</${tag}>`;
  }

  // Split into visual blocks: walk down through wrappers until we reach
  // the level where the page is a stack of sibling sections.
  const roots = [];
  (function walk(el, depth) {
    const kids = visibleKids(el);
    const h = el.getBoundingClientRect().height;
    if (depth < 7 && kids.length === 1 && h > 900) {
      walk(kids[0], depth + 1);
    } else if (depth < 7 && kids.length >= 2 && h > 900) {
      kids.forEach((k) => walk(k, depth + 1));
    } else {
      roots.push(el);
    }
  })(document.body, 0);

  return roots.slice(0, 14).map((el, i) => {
    const ctx = { n: 0 };
    const html = snap(el, 0, null, ctx).slice(0, 9000);
    return {
      index: i,
      tag: el.tagName.toLowerCase(),
      height: Math.round(el.getBoundingClientRect().height),
      html,
    };
  }).filter((b) => b.html);
}
