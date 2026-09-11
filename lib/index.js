/**
 * dsh-darkplus-code — Host half.
 *
 * Owns the ONE durable piece of this plugin: the user's code-block appearance
 * settings, stored as a plain JSON file at `~/.dsh-darkplus-code/config.json`
 * (port-independent — unlike localStorage, which is origin-scoped and therefore
 * reset whenever DSH Desktop restarts on a new random loopback port).
 *
 * The browser half reads and writes them over a same-origin route
 * (GET/PUT /darkplus-code/settings). No HTML is served here and no repository
 * code is ever evaluated: the route only reads and writes that one file.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Route prefix owned by this plugin. */
const BASE = '/darkplus-code';

/** Absolute path of the settings file this plugin owns. */
function configPath() {
  return join(homedir(), '.dsh-darkplus-code', 'config.json');
}

/** Field holding the appearance settings inside the config document. */
const SETTINGS_FIELD = 'settings';

/**
 * Accepted appearance modes.
 *  - `follow`  code font size tracks the DSH content font size (same delta mechanism)
 *  - `scale`   code font size is a fixed ratio of the DSH content font size
 *  - `fixed`   code font size is a constant px value
 */
const MODES = Object.freeze(['follow', 'scale', 'fixed']);

/** Defaults used when the file is missing or a field is unusable. */
const DEFAULTS = Object.freeze({
  // Dark+ recolor of chat code blocks.
  palette: true,
  // Which token gets the teal treatment: types+functions teal, or Dark+ native yellow.
  variant: 'typeTeal',
  // Font sizing.
  mode: 'follow',
  ratio: 0.9,
  fixedPx: 15,
  // Font family is left to DSH unless the user overrides it.
  fontFamily: '',
});

/** Clamp a number into an inclusive integer range, falling back on garbage. */
function clampInt(value, min, max, fallback) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Clamp a ratio into a sane range. */
function clampRatio(value, fallback) {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(2, Math.max(0.5, Math.round(n * 100) / 100));
}

/**
 * Coerce an untrusted settings object into the exact stored shape.
 * Every field is bounded, so a malformed PUT can never widen the CSS this
 * plugin generates beyond the values it permits.
 */
function sanitize(input) {
  const raw = input !== null && typeof input === 'object' ? input : {};
  const opts = raw.appearance !== null && typeof raw.appearance === 'object' ? raw.appearance : raw;
  const mode = MODES.includes(opts.mode) ? opts.mode : DEFAULTS.mode;
  const variant = opts.variant === 'funcYellow' ? 'funcYellow' : 'typeTeal';
  const fontFamily = typeof opts.fontFamily === 'string' ? opts.fontFamily.slice(0, 120) : DEFAULTS.fontFamily;
  return {
    palette: opts.palette === undefined ? DEFAULTS.palette : opts.palette !== false,
    variant,
    mode,
    ratio: clampRatio(opts.ratio, DEFAULTS.ratio),
    fixedPx: clampInt(opts.fixedPx, 9, 32, DEFAULTS.fixedPx),
    fontFamily,
  };
}

/** Read the config document, tolerating a missing or damaged file. */
function readConfig() {
  try {
    const text = readFileSync(configPath(), 'utf8');
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Read the persisted appearance settings, always returning a complete shape. */
function readSettings() {
  const cfg = readConfig();
  return sanitize(cfg[SETTINGS_FIELD]);
}

/** Publish the config document atomically (temp file + rename). */
function writeConfig(cfg) {
  const file = configPath();
  const tmp = `${file}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  const data = JSON.stringify(cfg, null, 2);
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

/** Persist appearance settings and return the stored (sanitized) shape. */
function writeSettings(settings) {
  const cfg = readConfig();
  const clean = sanitize(settings);
  cfg[SETTINGS_FIELD] = clean;
  writeConfig(cfg);
  return clean;
}

/** Read a request body with a hard cap, resolving to parsed JSON. */
function readJsonBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/** Send a JSON response. */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** Cordis plugin name; the loader mounts this module as the row named in the patch. */
export const name = 'darkplus-code';

/** Required services: none. `webServer` is optional and feature-detected. */
export const inject = [];

/**
 * Host plugin body.
 * @param ctx - host cordis context.
 */
export function apply(ctx) {
  const webServer = ctx.get('webServer');
  if (webServer === undefined) {
    // Headless / TUI profile: the settings file stays the source of truth and
    // the browser half simply cannot reach it. Nothing to serve.
    ctx.logger?.debug?.('[darkplus-code] webServer unavailable; settings route not mounted');
    return;
  }

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: `${BASE}/settings`,
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase();
      if (method === 'GET') {
        sendJson(res, 200, { ok: true, settings: readSettings() });
        return;
      }
      if (method === 'PUT' || method === 'POST') {
        try {
          const body = await readJsonBody(req);
          sendJson(res, 200, { ok: true, settings: writeSettings(body) });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: String((error && error.message) || error) });
        }
        return;
      }
      sendJson(res, 405, { ok: false, error: 'method not allowed' });
    },
  }), 'darkplus-code: settings route');
}
