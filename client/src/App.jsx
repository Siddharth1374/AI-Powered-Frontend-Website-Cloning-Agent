import { useState, useCallback, useRef } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackLayout,
  useSandpackConsole,
} from '@codesandbox/sandpack-react';
import { streamClone, modifySite, fixFile } from './api.js';

const VIEWPORTS = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  mobile: { width: '375px', label: 'Mobile' },
};

const STEPS = ['Fetch page', 'Analyze', 'Generate code', 'Validate'];
const STAGE_INDEX = { fetching: 0, analyzing: 1, understanding: 1, generating: 2, validating: 3, ready: 4 };

const MODES = [
  { id: 'fidelity', label: 'High fidelity', hint: 'Closer match, slower' },
  { id: 'fast', label: 'Fast', hint: 'Templates, one AI call' },
];

function toSandpackFiles(files) {
  const out = {};
  for (const [path, { code }] of Object.entries(files)) {
    // Sandpack's "vite-react" template supplies its own package.json / vite config.
    if (path === 'package.json' || path === 'vite.config.js') continue;
    out[`/${path}`] = code;
  }
  return out;
}

function Background() {
  return (
    <svg className="bg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b4b9a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2b2b2b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5bd0" stopOpacity="0.5" />
          <stop offset="1" stopColor="#2b2b2b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 0 H380 C300 120 160 220 0 260 Z" fill="url(#g1)" />
      <path d="M0 260 C160 220 300 120 380 0" fill="none" stroke="#e9b8a3" strokeOpacity="0.55" strokeWidth="1.5" />
      <rect x="1130" y="60" width="520" height="420" rx="210" fill="url(#g2)" transform="rotate(-18 1390 270)" />
      <rect x="1130" y="60" width="520" height="420" rx="210" fill="none" stroke="#e9b8a3" strokeOpacity="0.5" strokeWidth="1.5" transform="rotate(-18 1390 270)" />
      <g stroke="#6d5bd0" strokeOpacity="0.45" strokeWidth="1">
        <line x1="120" y1="900" x2="330" y2="560" />
        <line x1="290" y1="900" x2="440" y2="640" />
        <line x1="1090" y1="470" x2="1330" y2="900" />
        <line x1="1260" y1="520" x2="1440" y2="760" />
      </g>
    </svg>
  );
}

export default function App() {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState(null); // null | fetching | ... | ready | error
  const [log, setLog] = useState([]);
  const [site, setSite] = useState(null); // { id, spec, files }
  const [viewport, setViewport] = useState('desktop');
  const [mode, setMode] = useState('fidelity');
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const stopRef = useRef(null);

  const running = stage && !['ready', 'error'].includes(stage);
  const compact = !!stage; // shrink the hero once a clone has started

  const startClone = useCallback(() => {
    const target = url.trim();
    if (!target || running) return;
    setErrorMsg(null);
    setSite(null);
    setLog([]);
    setStage('fetching');
    stopRef.current?.();
    stopRef.current = streamClone(target, mode, {
      onProgress: ({ stage, message }) => {
        setStage(stage);
        setLog((l) => [...l, { stage, message }]);
      },
      onDone: ({ siteId, spec, files }) => {
        setStage('ready');
        setSite({ id: siteId, spec, files });
      },
      onError: ({ message }) => {
        setStage('error');
        setErrorMsg(message);
      },
    });
  }, [url, mode, running]);

  const sendInstruction = useCallback(async () => {
    if (!site || !instruction.trim() || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { spec, files } = await modifySite(site.id, instruction.trim());
      setSite((s) => ({ ...s, spec, files }));
      setInstruction('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  }, [site, instruction, busy]);

  const current = STAGE_INDEX[stage] ?? -1;
  const lastMessage = log.length ? log[log.length - 1].message : '';

  return (
    <div className="page">
      <Background />

      <header className="nav">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">SY Forge</span>
        </div>
        <nav className="nav-links">
          <a href="#clone">Clone website</a>
          <a href="#how">How it works</a>
          <a href="#preview">Preview</a>
        </nav>
        <span className="nav-pill">{mode === 'fidelity' ? 'High fidelity' : 'Fast'} mode</span>
      </header>

      <main className="content">
        <section id="clone" className={`hero ${compact ? 'compact' : ''}`}>
          <h1 className="headline">Clone any website</h1>
          <p className="lede">
            Clone any site and refine it with AI.
            {!compact && <><br />Preview instantly, then export clean React code.</>}
          </p>

          <div className={`prompt ${running ? 'is-running' : ''}`}>
            <textarea
              rows={compact ? 1 : 2}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a link to clone any website"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  startClone();
                }
              }}
              spellCheck={false}
            />
            <div className="prompt-row">
              <div className="chips">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`chip ${mode === m.id ? 'active' : ''}`}
                    onClick={() => setMode(m.id)}
                    title={m.hint}
                    type="button"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button className="go" onClick={startClone} disabled={running || !url.trim()} aria-label="Clone website">
                {running ? <span className="spinner" /> : '→'}
              </button>
            </div>
          </div>

          {!compact && (
            <ul id="how" className="how">
              <li><b>1</b> Reads the live page in a real browser</li>
              <li><b>2</b> Writes React + Tailwind components</li>
              <li><b>3</b> Previews it, then edit with plain English</li>
            </ul>
          )}
        </section>

        {stage && stage !== 'error' && (
          <section className="steps-card">
            <ol className="steps">
              {STEPS.map((label, i) => {
                const state = stage === 'ready' || i < current ? 'done' : i === current ? 'active' : '';
                return (
                  <li key={label} className={state}>
                    <span className="dot">{state === 'done' ? '✓' : i + 1}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
            {lastMessage && <p className="status-line">{lastMessage}</p>}
          </section>
        )}

        {errorMsg && <div className="error-banner">⚠ {errorMsg}</div>}

        {site && (
          <section id="preview" className="workspace">
            <div className="preview-toolbar">
              <div className="viewport-toggle">
                {Object.entries(VIEWPORTS).map(([key, v]) => (
                  <button key={key} className={viewport === key ? 'active' : ''} onClick={() => setViewport(key)}>
                    {v.label}
                  </button>
                ))}
              </div>
              <span className="section-count">{site.spec.sections.length} sections</span>
            </div>

            <div className="sandbox">
              <SandpackProvider
                key={JSON.stringify(Object.keys(site.files))}
                template="vite-react"
                theme="dark"
                files={toSandpackFiles(site.files)}
                options={{ recompileMode: 'delayed', recompileDelay: 300 }}
              >
                <SandpackLayout>
                  <div style={{ width: VIEWPORTS[viewport].width, margin: '0 auto', transition: 'width .2s' }}>
                    <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton style={{ height: 640 }} />
                  </div>
                  <SandpackCodeEditor showTabs showLineNumbers wrapContent style={{ height: 420 }} />
                </SandpackLayout>
                <ErrorWatcher siteId={site.id} onFixed={(files) => setSite((s) => ({ ...s, files }))} />
              </SandpackProvider>
            </div>

            <div className="prompt modify">
              <textarea
                rows={1}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='Refine it: "Change the primary color to blue" or "Add a testimonials section"'
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendInstruction();
                  }
                }}
                disabled={busy}
              />
              <div className="prompt-row">
                <span className="hint">{busy ? 'Applying your change…' : 'Press Enter to apply'}</span>
                <button className="go" onClick={sendInstruction} disabled={busy || !instruction.trim()} aria-label="Apply change">
                  {busy ? <span className="spinner" /> : '→'}
                </button>
              </div>
            </div>

            <details className="history">
              <summary>View generated structure</summary>
              <pre>{JSON.stringify(site.spec, null, 2)}</pre>
            </details>
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * Watches Sandpack's console for bundler/runtime errors and offers a
 * one-click "Ask AI to fix" action (POST /api/sites/:id/fix).
 */
function ErrorWatcher({ siteId, onFixed }) {
  const { logs } = useSandpackConsole({ resetOnPreviewRestart: true });
  const errorLog = logs.find((l) => l.method === 'error');
  const [fixing, setFixing] = useState(false);

  if (!errorLog) return null;

  const message = Array.isArray(errorLog.data) ? errorLog.data.join(' ') : String(errorLog.data);

  const handleFix = async () => {
    setFixing(true);
    try {
      const match = message.match(/components\/([A-Za-z0-9]+)\.jsx/);
      const path = match ? `src/components/${match[1]}.jsx` : 'src/App.jsx';
      const { files } = await fixFile(siteId, path, message);
      onFixed(files);
    } catch (e) {
      console.warn('Auto-fix failed:', e.message);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="preview-error-banner">
      <span>Preview error detected: {message.slice(0, 160)}</span>
      <button onClick={handleFix} disabled={fixing}>
        {fixing ? 'Fixing…' : 'Ask AI to fix'}
      </button>
    </div>
  );
}
