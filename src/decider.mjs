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
const userToDevice = new Map();

/**
 * 테스트 및 재설정을 위해 바인딩 정보를 초기화합니다.
 */
export function resetBindings() {
  deviceToUser.clear();
  userToDevice.clear();
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

  // 1. 신원(로그인) 확인 검증 (확인 실패 방어)
  const subjectId = typeof request.subjectId === 'string' ? request.subjectId.trim() : '';
  if (!subjectId) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 2. 기기 식별자 검증 (확인 실패 방어)
  const deviceId = typeof request.deviceId === 'string' ? request.deviceId.trim() : '';
  if (!deviceId) {
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

  // 4. 동작(method) 검증 (내 자료실 읽기만 허용)
  if (request.method !== 'GET') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 5. 경로(service/route/path) 검증 (내 자료실 경로만 허용)
  if (request.service && request.service !== 'notes') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  const isNotesService = request.service === 'notes';
  const isNotesRoute = typeof request.route === 'string' && request.route.includes('notes');
  const isNotesPath = typeof request.path === 'string' && request.path.includes('notes');
  if (!isNotesService && !isNotesRoute && !isNotesPath) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 6. 사용자와 기기 1:1 바인딩 검증 (그 사용자와 묶인 기기만 허용, 다른 사용자의 기기 거부)
  const boundUser = deviceToUser.get(deviceId);
  const boundDevice = userToDevice.get(subjectId);

  if (boundUser && boundUser !== subjectId) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  if (boundDevice && boundDevice !== deviceId) {
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
  if (!boundDevice) {
    userToDevice.set(subjectId, deviceId);
  }

  // 7. XDR 거부 규칙 검증 (동적 차단 목록 연동)
  const activeRules = getDenyRules(Date.now());
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

  // 8. 모든 조건을 충족한 등록 기기의 정상 자료실 읽기 요청 허용
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered'],
  };
}
