import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_LOG_DIR, getRouterDebugState, resolveLogDir, routerDebugLog, sanitizeLogText, setRouterDebugState } from '../logger.js';

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

describe('sanitizeLogText', () => {
  it('redacts credentials in text, URLs, headers, and serialized objects', () => {
    const text = [
      'https://api.example.test?api_key=url-secret&x=1',
      'Authorization: Bearer header-secret',
      'Bearer standalone-secret',
      'apiKey: object-secret',
      '{"access_token":"token-secret","safe":"value"}',
    ].join(' ');
    const sanitized = sanitizeLogText(text);

    expect(sanitized).not.toContain('url-secret');
    expect(sanitized).not.toContain('header-secret');
    expect(sanitized).not.toContain('standalone-secret');
    expect(sanitized).not.toContain('object-secret');
    expect(sanitized).not.toContain('token-secret');
    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).toContain('safe');
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

  it('serializes Error objects with stack without leaking credentials', () => {
    const dir = makeTmpDir();
    setRouterDebugState({ debug: true, logDir: dir });
    routerDebugLog('[pi-router] boom:', new Error('request failed: Authorization: Bearer secret-from-stack'));
    const today = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(path.join(dir, `router-${today}.log`), 'utf-8');
    expect(content).toContain('Error: request failed');
    expect(content).not.toContain('secret-from-stack');
    expect(content).toContain('[REDACTED]');
  });

  it('redacts sensitive object fields before writing them', () => {
    const dir = makeTmpDir();
    setRouterDebugState({ debug: true, logDir: dir });
    routerDebugLog({ apiKey: 'object-secret', nested: { accessToken: 'token-secret' }, safe: 'value' });
    const today = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(path.join(dir, `router-${today}.log`), 'utf-8');
    expect(content).not.toContain('object-secret');
    expect(content).not.toContain('token-secret');
    expect(content).toContain('[REDACTED]');
    expect(content).toContain('value');
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
