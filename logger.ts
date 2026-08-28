/**
 * File-backed debug logger for pi-router.
 *
 * PI_ROUTER_DEBUG=1 keeps the legacy console behaviour. Setting
 * `debug: true` in pi-router.json additionally appends every log line to a
 * per-day file under `logDir` (default `~/pi-data/pi-router/logs`), so
 * unexpected failovers ("healthy" model switched, all-routes-exhausted) can
 * be diagnosed from the raw errors without attaching a console.
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

function formatLogValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === "undefined") return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
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
  if (process.env.PI_ROUTER_DEBUG === "1") {
    console.log(...args);
  }
  if (debugState.debug) {
    const message = args.map(formatLogValue).join(" ");
    appendToLogFile(`[${new Date().toISOString()}] ${message}`);
  }
}
