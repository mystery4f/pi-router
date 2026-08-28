import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_LOG_DIR, getRouterDebugState, resolveLogDir, routerDebugLog, setRouterDebugState } from '../logger.js';

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-router-log-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  setRouterDebugState({ debug: false, logDir: null });
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveLogDir', () => {
  it('falls back to ~/pi-data/pi-router/logs when unset', () => {
    expect(resolveLogDir(undefined)).toBe(DEFAULT_LOG_DIR);
    expect(DEFAULT_LOG_DIR).toContain(path.join('pi-data', 'pi-router', 'logs'));
  });

  it('expands a leading ~', () => {
    expect(resolveLogDir('~/my-logs')).toBe(path.join(os.homedir(), 'my-logs'));
  });

  it('treats empty strings as unset', () => {
    expect(resolveLogDir('')).toBe(DEFAULT_LOG_DIR);
    expect(resolveLogDir('  ')).toBe(DEFAULT_LOG_DIR);
  });
});

describe('routerDebugLog file mode', () => {
  it('appends debug lines to router-<date>.log when enabled', () => {
    const dir = makeTmpDir();
    setRouterDebugState({ debug: true, logDir: dir });
    routerDebugLog('[pi-router] Failure recorded glm@zhipu: Connection error.');
    const today = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, `router-${today}.log`);
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toContain('Failure recorded glm@zhipu: Connection error.');
    expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
  });

  it('serializes Error objects with stack', () => {
    const dir = makeTmpDir();
    setRouterDebugState({ debug: true, logDir: dir });
    routerDebugLog('[pi-router] boom:', new Error('kaboom'));
    const today = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(path.join(dir, `router-${today}.log`), 'utf-8');
    expect(content).toContain('Error: kaboom');
  });

  it('writes nothing when debug is disabled', () => {
    const absentDir = path.join(os.tmpdir(), `pi-router-log-absent-${Date.now()}`);
    setRouterDebugState({ debug: false, logDir: absentDir });
    try {
      routerDebugLog('[pi-router] should not persist');
      expect(fs.existsSync(absentDir)).toBe(false);
    } finally {
      setRouterDebugState({ debug: false, logDir: null });
    }
  });

  it('getRouterDebugState reports current state', () => {
    const dir = makeTmpDir();
    setRouterDebugState({ debug: true, logDir: dir });
    expect(getRouterDebugState()).toEqual({ debug: true, logDir: dir });
  });
});
