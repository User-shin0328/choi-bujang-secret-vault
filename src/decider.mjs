import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze([
  'device_registered',
  'xdr.brute_force.deny',
  'xdr.web_injection.deny',
]);

const DENY_RULES_PATH = resolve(import.meta.dirname, '..', 'xdr', 'deny-rules.json');
const memoryRules = new Map();
const deviceToUser = new Map();

/**
 * 테스트 및 재설정을 위해 바인딩 정보를 초기화합니다.
 */
export function resetBindings() {
  deviceToUser.clear();
}

/**
 * XDR 등에서 동적으로 생성된 거부 규칙을 등록합니다.
 * @param {{ ruleId: string, alertId: string, expiresAt: string, ip?: string, user?: string, reason?: string }} rule
 */
export function addDenyRule(rule) {
  if (rule?.alertId) {
    memoryRules.set(rule.alertId, rule);
  }
}

/**
 * 현재 유효한(만료되지 않은) 거부 규칙 목록을 조회합니다.
 * @param {number} [referenceTime=Date.now()]
 */
export function getDenyRules(referenceTime = Date.now()) {
  const rules = new Map(memoryRules);
  try {
    if (existsSync(DENY_RULES_PATH)) {
      const data = JSON.parse(readFileSync(DENY_RULES_PATH, 'utf8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item?.alertId) rules.set(item.alertId, item);
        }
      }
    }
  } catch {
    // 파일 조회 실패 시 메모리 규칙 유지
  }

  return Array.from(rules.values()).filter((r) => {
    if (!r.expiresAt) return true;
    const exp = Date.parse(r.expiresAt);
    return !Number.isNaN(exp) && exp > referenceTime;
  });
}

export async function decide(request) {
  if (!request || typeof request !== 'object') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request?.requestId ?? 'unknown',
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 1. XDR 거부 규칙 검증 (보너스 1, 2)
  const refTime = request?.at ? Date.parse(request.at) : Date.now();
  const validRefTime = Number.isNaN(refTime) ? Date.now() : refTime;
  const activeRules = getDenyRules(validRefTime);
  const matched = activeRules.find((rule) => {
    if (rule.alertId && request.alertId === rule.alertId) return true;
    if (rule.user && request.subjectId === rule.user) return true;
    if (rule.ip && request.signals?.source === rule.ip) return true;
    return false;
  });

  if (matched) {
    const activeRuleId = matched.ruleId && RULE_IDS.includes(matched.ruleId)
      ? matched.ruleId
      : 'xdr.web_injection.deny';
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'xdr_blocked',
      ruleIds: [activeRuleId],
    };
  }

  // 2. 엔진이 확인해 넘긴 신원(로그인) 및 기기 식별자 검증 (확인 실패 방어)
  const subjectId = typeof request.subjectId === 'string' ? request.subjectId.trim() : '';
  const deviceId = typeof request.deviceId === 'string' ? request.deviceId.trim() : '';
  if (!subjectId || !deviceId) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 3. 기기 등록 여부 검증 (미등록 기기 거부)
  if (request.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 4. 동작(method) 및 경로(service/route/path) 검증 (내 자료실 읽기만 허용)
  if (request.method !== 'GET') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  if (request.service && request.service !== 'notes') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  const route = request.route;
  const path = request.path;
  const isNotesRoute = (typeof route === 'string' && route.includes('/notes'))
    || (typeof path === 'string' && path.includes('/notes'));
  if (route && !isNotesRoute) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 5. 사용자와 기기 바인딩 검증 (그 사용자와 묶인 기기만 허용, 다른 사용자의 기기 거부)
  const boundUser = deviceToUser.get(deviceId);
  if (boundUser && boundUser !== subjectId) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  if (!boundUser) {
    deviceToUser.set(deviceId, subjectId);
  }

  // 6. 모든 조건을 충족한 등록 기기의 정상 자료실 읽기 요청 허용
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered'],
  };
}
