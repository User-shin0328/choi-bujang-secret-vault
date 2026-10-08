import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import patternsData from './patterns.json' with { type: 'json' };
import { addDenyRule } from '../../src/decider.mjs';

const PATTERNS = patternsData.patterns;
const PATTERN_HIGH_FREQ = PATTERNS[0].name; // 단일 출발 주소의 고빈도 연속 로그인 실패
const PATTERN_SPRAY = PATTERNS[1].name;     // 다수 계정 대상 동일 비밀번호 연속 대입 (패스워드 스프레이)
const PATTERN_MUTATION = PATTERNS[2].name;  // 규칙적 변형 비밀번호 연속 대입 시도

const XDR_DIR = resolve(import.meta.dirname, '..');
const ALERTS_LOG_PATH = resolve(XDR_DIR, 'alerts.log');
const DENY_RULES_PATH = resolve(XDR_DIR, 'deny-rules.json');

// 비밀값 패턴 검사 및 마스킹
const SECRET_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{16,}|\bsb_secret_[A-Za-z0-9_-]{12,}|\bsk-[A-Za-z0-9_-]{20,}|\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}|password\s*[:=]\s*\S+|pwd\s*[:=]\s*\S+/giu;

function sanitize(value) {
  if (typeof value !== 'string') return value ?? '';
  return value.replaceAll(SECRET_PATTERN, '[REDACTED]');
}

/**
 * 차단 후보를 ZTNA 거부 규칙 파일(xdr/deny-rules.json)과 판정기 메모리에 등록합니다.
 */
function recordDenyRule(rule) {
  try {
    addDenyRule(rule);
  } catch {
    // decider 직접 등록 실패 시 파일 등록으로 계속 진행
  }

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
    const srcuser = sanitize(alert?.data?.srcuser || alert?.data?.accounts || '-');
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
 * Jev AI 모델에 애매한 경보의 확신도(0~1) 질의를 시도합니다.
 * 환경변수 JEV_API_URL이 있거나 외부 엔드포인트가 제공될 때 호출하며,
 * 응답이 없거나 실패하면 null을 반환합니다.
 */
async function askJev(alert) {
  try {
    const endpoint = process.env.JEV_API_URL;
    if (endpoint) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert }),
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.confidence === 'number' && data.confidence >= 0 && data.confidence <= 1) {
          return data.confidence;
        }
      }
    }
  } catch {
    // Jev 응답 실패 시 폴백 처리로 연결
  }
  return null;
}

/**
 * 경보를 패턴과 대조하고, 애매한 경보는 Jev 질의(또는 폴백)를 통해 판정합니다.
 * - 확신도 0.85 이상: block -> 차단 후보만 ZTNA 거부 규칙에 등록하고 alerts.log에 기록
 * - 확신도 0.5 이상: alert -> alerts.log에 기록 (정상 사용자를 막지 않도록 ZTNA 규칙에는 등록하지 않음)
 * - 그 아래: record -> 정상 이벤트 (규칙 등록 및 알림 로그 없음)
 * - Jev 미응답 시: alert
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const desc = alert?.rule?.description ?? '';
  const data = alert?.data ?? {};

  // 1. 명확한 공격 (수준 10 이상): 확신도 0.90 -> block
  if (level >= 10) {
    let reason = PATTERN_HIGH_FREQ;
    if (data.accounts || desc.includes('여러 계정') || desc.includes('서로 다른 계정')) {
      reason = PATTERN_SPRAY;
    } else if (desc.includes('바꿔') || desc.includes('변형') || desc.includes('간격')) {
      reason = PATTERN_MUTATION;
    }

    const alertTime = alert?.timestamp ? Date.parse(alert.timestamp) : Date.now();
    const validTime = Number.isNaN(alertTime) ? Date.now() : Math.max(Date.now(), alertTime);
    const expiresAt = new Date(validTime + 24 * 60 * 60 * 1000).toISOString();

    const denyRule = {
      ruleId: 'xdr.brute_force.deny',
      alertId: alert.id,
      expiresAt,
      ip: data.srcip || '',
      user: data.srcuser || '',
      reason,
    };

    recordDenyRule(denyRule);
    logAlert(alert, 'block', reason, expiresAt);

    return {
      action: 'block',
      confidence: 0.9,
      reason,
    };
  }

  // 2. 정상 이벤트 (수준 3 이하): 확신도 0.10 -> record (정상 사용자를 막는 규칙은 넣지 않음)
  if (level <= 3) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: '정상 로그인 및 세션 활동',
    };
  }

  // 3. 애매한 시도 (수준 4~9): Jev에게 확신도(0~1) 질의
  const jevConfidence = await askJev(alert);

  let confidence;
  let action;

  // Jev가 응답하지 않으면 기본 alert로 결정
  if (typeof jevConfidence !== 'number') {
    confidence = 0.65;
    action = 'alert';
  } else {
    confidence = jevConfidence;
    if (confidence >= 0.85) {
      action = 'block';
    } else if (confidence >= 0.5) {
      action = 'alert';
    } else {
      action = 'record';
    }
  }

  let reason = PATTERN_HIGH_FREQ;
  if (data.accounts || desc.includes('두 계정') || desc.includes('계정')) {
    reason = PATTERN_SPRAY;
  } else if (desc.includes('비밀번호')) {
    reason = PATTERN_MUTATION;
  }

  if (action === 'block') {
    const alertTime = alert?.timestamp ? Date.parse(alert.timestamp) : Date.now();
    const validTime = Number.isNaN(alertTime) ? Date.now() : Math.max(Date.now(), alertTime);
    const expiresAt = new Date(validTime + 24 * 60 * 60 * 1000).toISOString();

    const denyRule = {
      ruleId: 'xdr.brute_force.deny',
      alertId: alert.id,
      expiresAt,
      ip: data.srcip || '',
      user: data.srcuser || '',
      reason,
    };

    recordDenyRule(denyRule);
    logAlert(alert, 'block', reason, expiresAt);
  } else if (action === 'alert') {
    logAlert(alert, 'alert', reason);
  }

  return {
    action,
    confidence,
    reason,
  };
}
