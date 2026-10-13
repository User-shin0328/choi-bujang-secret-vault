import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const XDR_DIR = resolve(__dirname, '..');
const ALERTS_LOG_PATH = resolve(XDR_DIR, 'alerts.log');
const DENY_RULES_PATH = resolve(XDR_DIR, 'deny-rules.json');
const DEFAULT_FIXTURE_PATH = resolve(XDR_DIR, 'fixtures', 'known-cve.json');

// 비밀값 패턴 검사 및 마스킹 (토큰, 비밀키, 패스워드 패턴 등)
const SECRET_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{16,}|\bsb_secret_[A-Za-z0-9_-]{12,}|\bsk-[A-Za-z0-9_-]{20,}|\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}|password\s*[:=]\s*\S+|pwd\s*[:=]\s*\S+/giu;

function sanitize(value) {
  if (typeof value !== 'string') return value ?? '';
  return value.replaceAll(SECRET_PATTERN, '[REDACTED]');
}

/**
 * 차단 후보를 ZTNA 거부 규칙 파일(xdr/deny-rules.json)에 등록합니다.
 */
function recordDenyRule(rule) {
  try {
    let rules = [];
    if (existsSync(DENY_RULES_PATH)) {
      const content = readFileSync(DENY_RULES_PATH, 'utf8');
      rules = JSON.parse(content);
      if (!Array.isArray(rules)) rules = [];
    }
    const existingIndex = rules.findIndex((r) => r.alertId === rule.alertId);
    if (existingIndex >= 0) {
      rules[existingIndex] = rule;
    } else {
      rules.push(rule);
    }
    writeFileSync(DENY_RULES_PATH, `${JSON.stringify(rules, null, 2)}\n`, 'utf8');
  } catch {
    // 파일 쓰기 예외 방지
  }
}

/**
 * xdr/alerts.log 에 한 줄씩 알림 로그를 기록합니다.
 */
function logAlert(alert, action, reason, expiresAt = null) {
  try {
    const timestamp = sanitize(alert?.timestamp || new Date().toISOString());
    const alertId = sanitize(alert?.id || '-');
    const srcip = sanitize(alert?.data?.srcip || '-');
    const srcuser = sanitize(alert?.data?.srcuser || alert?.data?.user || alert?.data?.dstuser || alert?.data?.accounts || '-');
    const safeReason = sanitize(reason || '-');

    let line;
    if (action === 'block' && expiresAt) {
      line = `[${timestamp}] [BLOCK] alertId: ${alertId} | ip: ${srcip} | user: ${srcuser} | expiresAt: ${expiresAt} | reason: ${safeReason}\n`;
    } else {
      line = `[${timestamp}] [${action.toUpperCase()}] alertId: ${alertId} | ip: ${srcip} | user: ${srcuser} | reason: ${safeReason}\n`;
    }
    appendFileSync(ALERTS_LOG_PATH, line, 'utf8');
  } catch {
    // 로그 쓰기 예외 방지
  }
}

/**
 * 단일 경보 및 판단 결과에 대해 대응 조치를 수행합니다.
 * - action이 'block'인 경우: 만료 시각(24시간)과 근거 경보 번호를 붙여 ZTNA 거부 규칙으로 등록하고 alerts.log에 기록
 * - action이 'alert'인 경우: alerts.log에 한 줄 기록 (정상 사용자를 막지 않도록 거부 규칙 미등록)
 * - action이 'record'인 경우: 거부 규칙 및 알림 로그 미등록 (정상 통과)
 */
export async function respond(alert, decision) {
  if (!alert || !decision) return null;

  if (decision.action === 'block') {
    const alertTime = alert.timestamp ? Date.parse(alert.timestamp) : Date.now();
    const validTime = Number.isNaN(alertTime) ? Date.now() : Math.max(Date.now(), alertTime);
    const expiresAt = new Date(validTime + 24 * 60 * 60 * 1000).toISOString();

    const denyRule = {
      ruleId: 'xdr.known_cve.deny',
      alertId: alert.id,
      expiresAt,
      ip: alert.data?.srcip || '',
      user: alert.data?.srcuser || alert.data?.user || alert.data?.dstuser || '',
      reason: decision.reason,
    };

    recordDenyRule(denyRule);
    logAlert(alert, 'block', decision.reason, expiresAt);
    return { status: 'blocked', denyRule };
  }

  if (decision.action === 'alert') {
    logAlert(alert, 'alert', decision.reason);
    return { status: 'alerted' };
  }

  return { status: 'recorded' };
}

/**
 * 경보 목록 전체를 decide와 연계하여 순회하며 respond를 실행합니다.
 */
export async function runRespond(fixturePath = DEFAULT_FIXTURE_PATH) {
  const content = await readFile(fixturePath, 'utf8');
  const fixture = JSON.parse(content);
  const results = [];

  for (const alert of fixture.alerts) {
    const decision = await decide(alert);
    const responseResult = await respond(alert, decision);
    results.push({ alertId: alert.id, decision, responseResult });
  }

  return results;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isMain) {
  const targetPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_FIXTURE_PATH;
  try {
    const results = await runRespond(targetPath);
    const blockedCount = results.filter((r) => r.decision.action === 'block').length;
    const alertedCount = results.filter((r) => r.decision.action === 'alert').length;
    const recordedCount = results.filter((r) => r.decision.action === 'record').length;
    console.log(`알려진 취약점(known-cve) 대응 완료: 차단 ${blockedCount}건, 알림 ${alertedCount}건, 통과 ${recordedCount}건`);
  } catch (err) {
    console.error('알려진 취약점 대응 실패:', err.message);
    process.exitCode = 1;
  }
}
