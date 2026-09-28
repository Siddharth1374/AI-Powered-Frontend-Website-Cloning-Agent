import { Router } from 'express';
import { nanoid } from 'nanoid';
import { analyzeWebsite } from './scraper.js';
import { buildSiteSpec } from './spec.js';
import { renderProject } from './renderer.js';
import { applyModification } from './modify.js';
import { fixFile } from './fix.js';
import { renderFidelityProject, modifyFidelityFiles } from './fidelity.js';
import { createSite, getSite, updateSite, pushHistory, listSites } from './store.js';

export const router = Router();

function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * GET /api/clone/stream?url=...
 * Streams pipeline progress via SSE: fetching -> analyzing -> generating ->
 * rendering -> done. This mirrors the "Expected Workflow" diagram in the
 * assignment so the UI can show each stage as it happens instead of a
 * single opaque spinner.
 */
router.get('/clone/stream', async (req, res) => {
  const { url } = req.query;
  if (!url || !/^https?:\/\//.test(url)) {
    res.status(400).json({ error: 'A valid http(s) url query param is required.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const siteId = nanoid(10);
  const mode = req.query.mode === 'fast' ? 'fast' : 'fidelity';

  try {
    sseSend(res, 'progress', { stage: 'fetching', message: `Loading ${url} in a headless browser…` });
    const analysis = await analyzeWebsite(url);

    sseSend(res, 'progress', {
      stage: 'analyzing',
      message: `Captured ${analysis.blocks?.length || 0} visual block(s) and ${analysis.sections.length} section(s).`,
    });

    let spec;
    let files;

    if (mode === 'fidelity') {
      sseSend(res, 'progress', { stage: 'generating', message: 'High-fidelity mode: writing a React component per section…' });
      ({ spec, files } = await renderFidelityProject(url, analysis, (done, total, usedFallback) =>
        sseSend(res, 'progress', {
          stage: 'generating',
          message: `Component ${done}/${total} ready${usedFallback ? ' (fallback used)' : ''}`,
        })
      ));
    } else {
      sseSend(res, 'progress', { stage: 'understanding', message: 'Fast mode: structuring the design into a site spec…' });
      spec = await buildSiteSpec(url, analysis);
      sseSend(res, 'progress', {
        stage: 'generating',
        message: `Rendering ${spec.sections.length} React component(s) from the spec…`,
      });
      ({ files } = await renderProject(spec));
    }

    createSite(siteId, { url, mode, meta: spec.meta, spec, files });
    pushHistory(siteId, { action: 'clone', url, mode });

    sseSend(res, 'progress', { stage: 'validating', message: 'Handing off to the in-browser preview for build validation…' });
    sseSend(res, 'done', { siteId, spec, files });
  } catch (err) {
    sseSend(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

/** GET /api/sites - list previously cloned sites (in-memory, this process only). */
router.get('/sites', (_req, res) => {
  res.json({ sites: listSites() });
});

/** GET /api/sites/:id - fetch a site's current spec + files. */
router.get('/sites/:id', (req, res) => {
  const site = getSite(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found.' });
  res.json({ id: site.id, url: site.url, spec: site.spec, files: site.files, history: site.history });
});

/**
 * POST /api/sites/:id/modify { instruction }
 * The "AI-Based Modification" step: patches the site spec via Groq, then
 * deterministically re-renders. Because the LLM only ever edits the JSON
 * spec (never raw JSX directly, except for genuinely novel "custom"
 * sections), a bad response can't produce broken code for anything
 * template-backed - it can at worst produce an odd spec, which
 * sanitizeSpec() already guards against.
 */
router.post('/sites/:id/modify', async (req, res) => {
  const site = getSite(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found.' });
  const { instruction } = req.body || {};
  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: '"instruction" (string) is required.' });
  }

  try {
    if (site.mode === 'fidelity') {
      const files = await modifyFidelityFiles(site.files, instruction);
      updateSite(site.id, { files });
      pushHistory(site.id, { action: 'modify', instruction });
      return res.json({ id: site.id, spec: site.spec, files });
    }
    const updatedSpec = await applyModification(site.spec, instruction);
    const { files } = await renderProject(updatedSpec);
    updateSite(site.id, { spec: updatedSpec, files });
    pushHistory(site.id, { action: 'modify', instruction });
    res.json({ id: site.id, spec: updatedSpec, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sites/:id/fix { path, errorMessage }
 * Called by the client when the in-browser preview reports a build/runtime
 * error for a specific generated file ("Error handling" requirement).
 */
router.post('/sites/:id/fix', async (req, res) => {
  const site = getSite(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found.' });
  const { path, errorMessage } = req.body || {};
  const file = site.files[path];
  if (!file) return res.status(400).json({ error: `Unknown file "${path}" for this site.` });

  try {
    const fixedCode = await fixFile({ path, code: file.code, errorMessage });
    const files = { ...site.files, [path]: { code: fixedCode } };
    updateSite(site.id, { files });
    pushHistory(site.id, { action: 'fix', path, errorMessage });
    res.json({ id: site.id, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
