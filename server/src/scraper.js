import { chromium } from 'playwright';
import { collectBlocks } from './snapshot.js';

/**
 * Analyze a public URL and return a compact, structured description of its
 * UI: layout landmarks, visible text, images, and *computed* styles for
 * colors/typography/spacing.
 *
 * Why Playwright instead of a plain HTML fetch (cheerio):
 *  - Most real sites render content with JS (React/Vue/framework hydration,
 *    lazy images, CSS-in-JS). A raw fetch of the HTML would miss most of
 *    the visible UI.
 *  - Computed styles (getComputedStyle) give us *exact* colors, font
 *    stacks, and spacing instead of asking an LLM to guess hex codes from
 *    a screenshot, which is both less accurate and needlessly expensive.
 *
 * Why we still take a screenshot: it's kept as a visual reference for a
 * human reviewer / optional future vision-model pass, but the pipeline's
 * design-token extraction below does NOT depend on it, which keeps the
 * core pipeline fast, deterministic and cheap.
 */
export async function analyzeWebsite(url, { screenshotPath } = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      // Some sites never go fully idle (polling/analytics). Fall back to
      // "loaded" so we don't fail the whole pipeline over that.
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    });

    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    }

    const analysis = await page.evaluate(() => {
      function styleOf(el) {
        const cs = getComputedStyle(el);
        return {
          color: cs.color,
          background: cs.backgroundColor,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          padding: cs.padding,
          borderRadius: cs.borderRadius,
        };
      }

      function textOf(el, max = 120) {
        const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
        return t.length > max ? t.slice(0, max) + '…' : t;
      }

      function absUrl(u) {
        try {
          return new URL(u, location.href).href;
        } catch {
          return u;
        }
      }

      // --- Landmarks -----------------------------------------------------
      const header = document.querySelector('header, nav, [role="navigation"]');
      const footer = document.querySelector('footer');
      const main = document.querySelector('main') || document.body;

      // Many modern sites (React/Next portfolios) use <button> or <a> without
      // href for in-page navigation, so collect both, de-duplicated.
      const navRoot = header || document;
      const seen = new Set();
      const navItems = Array.from(navRoot.querySelectorAll('a, button'))
        .map((a) => ({
          text: textOf(a, 24),
          href: absUrl(a.getAttribute('href') || '#'),
          isButtonLike:
            getComputedStyle(a).borderTopWidth !== '0px' ||
            (getComputedStyle(a).backgroundColor !== 'rgba(0, 0, 0, 0)'),
        }))
        .filter((l) => l.text && l.text.length <= 24 && !seen.has(l.text) && seen.add(l.text));
      const navLinks = navItems.filter((l) => !l.isButtonLike).slice(0, 10);
      const navCta = navItems.filter((l) => l.isButtonLike).slice(-1)[0]?.text || null;

      // Largest visible images (<img> and CSS background-image), for hero/gallery.
      const imgCandidates = [];
      document.querySelectorAll('img').forEach((img) => {
        const r = img.getBoundingClientRect();
        if (r.width > 120 && r.height > 120) {
          imgCandidates.push({ url: absUrl(img.currentSrc || img.src), area: r.width * r.height, top: r.top + scrollY });
        }
      });
      document.querySelectorAll('div, section, header').forEach((el) => {
        const bg = getComputedStyle(el).backgroundImage;
        const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
        const r = el.getBoundingClientRect();
        if (m && r.width > 120 && r.height > 120) {
          imgCandidates.push({ url: absUrl(m[1]), area: r.width * r.height, top: r.top + scrollY });
        }
      });
      const topImages = imgCandidates
        .filter((i) => i.url && !i.url.startsWith('data:'))
        .sort((a, b) => a.top - b.top)
        .slice(0, 8)
        .map((i) => i.url);

      // --- Section-level breakdown ----------------------------------
      // Treat top-level semantic blocks inside <main> as "sections" -
      // this becomes the skeleton the LLM organizes into a site spec.
      const sectionEls = Array.from(
        main.querySelectorAll('section, main > div, main > article')
      ).slice(0, 20);

      const sections = (sectionEls.length ? sectionEls : [main]).map((el, i) => {
        const heading = el.querySelector('h1, h2, h3');
        const paragraph = el.querySelector('p');
        const buttons = Array.from(el.querySelectorAll('a, button')).slice(0, 6);
        const images = Array.from(el.querySelectorAll('img'))
          .slice(0, 6)
          .map((img) => absUrl(img.currentSrc || img.src));

        return {
          index: i,
          tagHint: el.tagName.toLowerCase(),
          heading: heading ? textOf(heading, 100) : null,
          paragraph: paragraph ? textOf(paragraph, 200) : null,
          buttons: buttons.map((b) => textOf(b, 30)).filter(Boolean),
          images,
          imageCount: el.querySelectorAll('img').length,
          text: textOf(el, 400),
          style: styleOf(el),
        };
      });

      // --- Global design tokens ------------------------------------------
      const body = styleOf(document.body);
      const headingEl = document.querySelector('h1');
      const buttonEl = document.querySelector('button, a.btn, a[class*="button"]');

      // Sample a handful of elements to build a rough color palette.
      const sampleEls = Array.from(document.querySelectorAll('*')).filter(
        (_, i) => i % 37 === 0
      ).slice(0, 60);
      const colorCounts = {};
      for (const el of sampleEls) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          colorCounts[bg] = (colorCounts[bg] || 0) + 1;
        }
      }
      const topColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([c]) => c);

      return {
        title: document.title,
        description:
          document.querySelector('meta[name="description"]')?.content || '',
        favicon:
          document.querySelector('link[rel="icon"]')?.href ||
          absUrl('/favicon.ico'),
        hasHeader: !!header,
        hasFooter: !!footer,
        navLinks,
        navCta,
        topImages,
        footerText: footer ? textOf(footer, 300) : null,
        sections,
        theme: {
          bodyBackground: body.background,
          bodyTextColor: body.color,
          bodyFont: body.fontFamily,
          headingFont: headingEl ? styleOf(headingEl).fontFamily : body.fontFamily,
          buttonStyle: buttonEl ? styleOf(buttonEl) : null,
          paletteSample: topColors,
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    });

    // Visual block snapshots (used by high-fidelity mode).
    await page.waitForTimeout(800); // let entrance animations settle
    analysis.blocks = await page.evaluate(collectBlocks).catch(() => []);
    analysis.theme.rootBackground = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor
    );

    return analysis;
  } finally {
    await browser.close();
  }
}
