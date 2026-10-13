// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계: 등록한 기기만 자료실에 들어옵니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze([
  'device_registered',
]);

const deviceToUser = new Map();

/**
 * 테스트 및 재설정을 위해 바인딩 정보를 초기화합니다.
 */
export function resetBindings() {
  deviceToUser.clear();
}

/**
 * 판정 요청 계약(docs/DECIDER_REQUEST.md)에 따라 엔진이 확인해 전달한
 * 로그인·기기·동작·경로만 보고, 등록되어 해당 사용자와 묶인 기기의 내 자료실 읽기만 허용합니다.
 * @param {Record<string, unknown>} request
 */
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

  // 3. 기기 등록 상태 검증 (미등록 기기 거부)
  if (request.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 4. 동작(method) 검증 (내 자료실 읽기 GET 동작만 허용)
  if (request.method !== 'GET') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 5. 경로(service/route/path) 검증 (내 자료실 notes 경로만 허용)
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

  // 6. 사용자와 기기 바인딩 검증 (해당 사용자와 묶인 기기만 허용, 다른 사용자의 기기 거부)
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

  // 7. 모든 조건을 충족한 등록 기기의 정상 자료실 읽기 요청 허용
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered'],
  };
}
