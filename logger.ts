/**
 * File-backed debug logger for pi-router.
 *
 * PI_ROUTER_DEBUG=1 keeps the legacy console behaviour. Setting
 * `debug: true` in pi-router.json additionally appends every log line to a
 * per-day file under `logDir` (default `~/pi-data/pi-router/logs`), so
 * unexpected failovers ("healthy" model switched, all-routes-exhausted) can
 * be diagnosed from sanitized error details without attaching a console.
 *
 * @author dongcheng.xie
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const DEFAULT_LOG_DIR = path.join(os.homedir(), "pi-data", "pi-router", "logs");
const MAX_LOG_FILE_BYTES = 10 * 1024 * 1024;

type RouterDebugState = {
  debug: boolean;
  logDir: string;
};

let debugState: RouterDebugState = { debug: false, logDir: DEFAULT_LOG_DIR };

function expandHome(dir: string): string {
  if (dir === "~") return os.homedir();
  if (dir.startsWith("~/") || dir.startsWith("~\\")) {
    return path.join(os.homedir(), dir.slice(2));
  }
  return dir;
}

export function resolveLogDir(configuredLogDir?: string | null): string {
  const trimmed = (configuredLogDir || "").trim();
  return trimmed.length > 0 ? expandHome(trimmed) : DEFAULT_LOG_DIR;
}

export function setRouterDebugState(config?: { debug?: boolean; logDir?: string | null }): void {
  debugState = {
    debug: !!config?.debug,
    logDir: resolveLogDir(config?.logDir),
  };
}

export function getRouterDebugState(): RouterDebugState {
  return { ...debugState };
}

const SENSITIVE_KEY = /(?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|token|auth(?:orization)?|bearer|password|passwd|secret|credential)/i;
const SENSITIVE_QUERY_PARAMETER = /([?&](?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|token|auth(?:orization)?|password|secret|credential)=)[^&#\s]+/gi;
const SENSITIVE_HEADER_VALUE = /((?:authorization|proxy-authorization|x-api-key|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token)\s*:\s*)(?:(?:bearer|basic)\s+)?[^\s,;]+/gi;
const SENSITIVE_BEARER_VALUE = /\b(bearer|basic)\s+[^\s,;]+/gi;
const SENSITIVE_ASSIGNMENT = /((?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|token|password|passwd|secret|credential|authorization)\s*[:=]\s*)(["']?)[^\s,;}'\"]+\2/gi;
const SENSITIVE_JSON_FIELD = /(["']?(?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|token|password|passwd|secret|credential|authorization)["']?\s*:\s*)(["'])(.*?)\2/gi;

export function sanitizeLogText(value: string): string {
  return value
    .replace(SENSITIVE_QUERY_PARAMETER, "$1[REDACTED]")
    .replace(SENSITIVE_HEADER_VALUE, "$1[REDACTED]")
    .replace(SENSITIVE_BEARER_VALUE, "$1 [REDACTED]")
    .replace(SENSITIVE_JSON_FIELD, "$1$2[REDACTED]$2")
    .replace(SENSITIVE_ASSIGNMENT, "$1$2[REDACTED]$2");
}

function sanitizeLogObject(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return sanitizeLogText(value);
  if (value instanceof Error) {
    return sanitizeLogText(value.stack || `${value.name}: ${value.message}`);
  }
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => sanitizeLogObject(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeLogObject(child, seen);
  }
  return result;
}

function formatLogValue(value: unknown): string {
  if (typeof value === "string") return sanitizeLogText(value);
  if (value instanceof Error) return sanitizeLogText(value.stack || `${value.name}: ${value.message}`);
  if (typeof value === "undefined") return "undefined";
  try {
    return sanitizeLogText(JSON.stringify(sanitizeLogObject(value, new WeakSet())));
  } catch {
    return sanitizeLogText(String(value));
  }
}

function appendToLogFile(line: string): void {
  try {
    const dir = debugState.logDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `router-${new Date().toISOString().slice(0, 10)}.log`);
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_LOG_FILE_BYTES) {
        fs.renameSync(filePath, `${filePath}.old`);
      }
    } catch {
      // Rotation failures must not block the write.
    }
    fs.appendFileSync(filePath, line + "\n", "utf-8");
  } catch {
    // Logging must never break routing.
  }
}

export function routerDebugLog(...args: unknown[]): void {
  if (args.length === 0) return;
  const formattedArgs = args.map(formatLogValue);
  if (process.env.PI_ROUTER_DEBUG === "1") {
    console.log(...formattedArgs);
  }
  if (debugState.debug) {
    const message = formattedArgs.join(" ");
    appendToLogFile(`[${new Date().toISOString()}] ${message}`);
  }
}
