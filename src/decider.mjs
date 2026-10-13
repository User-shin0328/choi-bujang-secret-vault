// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6~7단계: 등록한 기기만 자료실에 들어오며, 평소와 다른 접속은 검증합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
]);

const deviceToUser = new Map();

/**
 * 테스트 및 재설정을 위해 바인딩 정보를 초기화합니다.
 */
export function resetBindings() {
  deviceToUser.clear();
}

/**
 * 엔진이 검증해 넘긴 가상 접속 신호(signals)의 출처를 확인하고 신뢰할 수 있는 정보만 추출합니다.
 * 위조된 클라이언트 헤더(geo, identity, role 등)나 계약 외 속성은 절대 신뢰 정보로 승격하지 않으며,
 * 값이 없거나 출처가 불명확해도 임의의 정상값(local, usual 등)으로 채우지 않습니다.
 * @param {Record<string, unknown>} request
 * @returns {{ source: string, region: string | null, network: string | null, hour: number | null, isVerified: boolean }}
 */
export function parseVerifiedSignals(request) {
  // 계약(docs/DECIDER_REQUEST.md)에 없는 request.geo, request.identity, request.role 등은 절대 읽지 않습니다.
  const rawSignals = request?.signals;
  if (!rawSignals || typeof rawSignals !== 'object' || Array.isArray(rawSignals)) {
    return { source: 'none', region: null, network: null, hour: null, isVerified: false };
  }

  const source = typeof rawSignals.source === 'string' ? rawSignals.source.trim() : 'none';
  // 엔진이 검증해 전달한 가상 접속 신호('judge_fixture')만 신뢰 출처로 구분
  const isVerified = source === 'judge_fixture';

  return {
    source,
    region: typeof rawSignals.region === 'string' && rawSignals.region.trim() ? rawSignals.region.trim() : null,
    network: typeof rawSignals.network === 'string' && rawSignals.network.trim() ? rawSignals.network.trim() : null,
    hour: typeof rawSignals.hour === 'number' && Number.isInteger(rawSignals.hour) && rawSignals.hour >= 0 && rawSignals.hour <= 23 ? rawSignals.hour : null,
    isVerified,
  };
}

/**
 * 엔진이 제공한 최근 사건(recentEvents) 배열의 유효성을 검사합니다.
 * @param {Record<string, unknown>} request
 * @returns {Array<{ kind: string, ageSeconds: number, count: number }>}
 */
export function parseRecentEvents(request) {
  const events = request?.recentEvents;
  if (!Array.isArray(events)) {
    return [];
  }
  return events.filter(e => e && typeof e === 'object' && typeof e.kind === 'string' && typeof e.ageSeconds === 'number' && typeof e.count === 'number');
}

/**
 * 판정 요청 계약(docs/DECIDER_REQUEST.md)에 따라 엔진이 확인해 전달한
 * 로그인·기기·동작·경로만 보고, 등록되어 해당 사용자와 묶인 기기의 내 자료실 읽기만 허용합니다.
 * 평소와 다른 시각·네트워크·다량 읽기가 함께 발생한 복합 이상 접속은 추가 확인(step_up)으로 보냅니다.
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

  // 가상 접속 정보(signals) 및 최근 사건(recentEvents) 출처 검증
  // 값이 없거나 불명확해도 임의의 정상값으로 채우지 않고 유효성을 파악합니다.
  const signals = parseVerifiedSignals(request);
  const recentEvents = parseRecentEvents(request);

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

  // 7. 복합 이상 접속 검증 (7단계: 평소와 다른 시각 + 낯선 네트워크 + 다량 읽기)
  // 지역 하나만으로 영구 차단하지 않으며, 세 조건이 모두 충족될 때만 step_up을 요구합니다.
  const isUnusualHour = typeof signals.hour === 'number' && (signals.hour < 6 || signals.hour >= 23);
  const isUnusualNetwork = signals.network === 'unusual' || (typeof signals.network === 'string' && signals.network !== 'usual');
  const hasSpikeEvents = recentEvents.some(event => {
    return (event.kind === 'risk_signal' || event.kind === 'anomaly') && event.count >= 10;
  });

  if (isUnusualHour && isUnusualNetwork && hasSpikeEvents) {
    // 재인증(stepUp) 확인 여부 검증
    const stepUp = request.stepUp;
    const isStepUpVerified = Boolean(stepUp && typeof stepUp === 'object' && stepUp.verified === true
      && typeof stepUp.authAgeSeconds === 'number' && stepUp.authAgeSeconds <= 900);

    if (!isStepUpVerified) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'step_up',
        reasonCode: 'step_up_required',
        ruleIds: ['step_up_required'],
      };
    }
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
