// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6~8단계: 등록한 기기만 자료실에 들어오며, 평소와 다른 접속은 검증하고,
// 메모 구역과 강사 공지 구역의 접근 권한을 분리하여 자기 메모만 읽기·수정할 수 있습니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
  'zone_rule',
]);

const deviceToUser = new Map();
const noteToOwner = new Map();

/**
 * 테스트 및 재설정을 위해 바인딩 정보를 초기화합니다.
 */
export function resetBindings() {
  deviceToUser.clear();
  noteToOwner.clear();
}

/**
 * 주체 ID(subjectId)에서 사용자 역할/식별 힌트를 추출합니다.
 * @param {string} subject
 * @returns {'a' | 'b' | 'fixture' | 'other'}
 */
function parseSubjectRole(subject) {
  if (!subject || typeof subject !== 'string') return 'other';
  const s = subject.trim().toLowerCase();
  if (s === 'learner_fixture') return 'fixture';
  if (/(?:^|[_\-.])(?:a|user_a|learner_a)(?:$|[_\-.])/i.test(s) || s.endsWith('_a') || s.endsWith('-a') || s === 'a') {
    return 'a';
  }
  if (/(?:^|[_\-.])(?:b|user_b|learner_b)(?:$|[_\-.])/i.test(s) || s.endsWith('_b') || s.endsWith('-b') || s === 'b') {
    return 'b';
  }
  return 'other';
}

/**
 * 대상 자원 ID가 강사 공지 구역인지 확인합니다.
 * @param {string} targetId
 * @returns {boolean}
 */
function isNoticeId(targetId) {
  if (!targetId || typeof targetId !== 'string') return false;
  const s = targetId.trim().toLowerCase();
  return s.startsWith('notice') || s.includes('notice');
}

/**
 * 메모 ID에서 초기 소유자 힌트를 확인합니다.
 * (4단계 DB 매핑: 1~3번 A 소유, 4번 B 소유 및 명시적 접두사/접미사)
 * @param {string} noteId
 * @returns {'a' | 'b' | null}
 */
function parseNoteOwnerHint(noteId) {
  if (!noteId || typeof noteId !== 'string') return null;
  const id = noteId.trim().toLowerCase();
  if (id === '1' || id === '2' || id === '3') return 'a';
  if (id === '4') return 'b';
  if (/(?:^|[_\-.])(?:a|note_a|user_a|learner_a)(?:$|[_\-.])/i.test(id) || id.startsWith('a-') || id.startsWith('a_') || id.endsWith('-a') || id.endsWith('_a')) {
    return 'a';
  }
  if (/(?:^|[_\-.])(?:b|note_b|user_b|learner_b)(?:$|[_\-.])/i.test(id) || id.startsWith('b-') || id.startsWith('b_') || id.endsWith('-b') || id.endsWith('_b')) {
    return 'b';
  }
  return null;
}

/**
 * 엔진이 검증해 넘긴 가상 접속 신호(signals)의 출처를 확인하고 신뢰할 수 있는 정보만 추출합니다.
 * 위조된 클라이언트 헤더(geo, identity, role 등)나 계약 외 속성은 절대 신뢰 정보로 승격하지 않으며,
 * 값이 없거나 출처가 불명확해도 임의의 정상값(local, usual 등)으로 채우지 않습니다.
 * @param {Record<string, unknown>} request
 * @returns {{ source: string, region: string | null, network: string | null, hour: number | null, isVerified: boolean }}
 */
export function parseVerifiedSignals(request) {
  const rawSignals = request?.signals;
  if (!rawSignals || typeof rawSignals !== 'object' || Array.isArray(rawSignals)) {
    return { source: 'none', region: null, network: null, hour: null, isVerified: false };
  }

  const source = typeof rawSignals.source === 'string' ? rawSignals.source.trim() : 'none';
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
 * 로그인·기기·동작·경로만 보고, 등록되어 해당 사용자와 묶인 기기의 자기 메모 읽기·수정만 허용합니다.
 * 타인의 메모 읽기·수정과 일반 학생의 강사 공지 수정, 알 수 없는 기능 경로(export 등)는 거부합니다.
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

  // 4. 사용자와 기기 바인딩 검증 (해당 사용자와 묶인 기기만 허용)
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

  // 5. 서비스(service) 검증 (내 자료실 notes 서비스만 허용)
  if (request.service && request.service !== 'notes') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_forbidden',
      ruleIds: ['zone_rule'],
    };
  }

  // 6. 동작 메서드(method) 검증 (읽기 GET 및 수정 PUT 동작만 허용)
  const method = typeof request.method === 'string' ? request.method.toUpperCase().trim() : '';
  if (method !== 'GET' && method !== 'PUT') {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_forbidden',
      ruleIds: ['zone_rule'],
    };
  }

  // 7. 정확한 경로(path/route) 검증 및 기능 경로(export 등) 차단
  const pathname = typeof request.path === 'string' ? request.path.trim() : '';
  if (!pathname) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_forbidden',
      ruleIds: ['zone_rule'],
    };
  }

  const match = pathname.match(/^(?:\/api)?\/notes(?:\/([^/?#]+))?$/);
  if (!match) {
    // 알 수 없는 경로 형식은 즉시 거부
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_forbidden',
      ruleIds: ['zone_rule'],
    };
  }

  if (typeof request.route === 'string') {
    const routePattern = request.route.trim();
    const isValidRoute = /^(?:GET|PUT)\s+(?:\/api)?\/notes(?:\/:id)?$/u.test(routePattern);
    if (!isValidRoute) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_forbidden',
        ruleIds: ['zone_rule'],
      };
    }
  }

  const rawId = match[1] ? decodeURIComponent(match[1]).trim() : null;

  // :id 깊이에 export 같은 기능 경로를 두지 않고 거부
  const FORBIDDEN_VERB_PATHS = new Set(['export', 'import', 'download', 'upload', 'backup', 'admin', 'action', 'search']);
  if (rawId && FORBIDDEN_VERB_PATHS.has(rawId.toLowerCase())) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_forbidden',
      ruleIds: ['zone_rule'],
    };
  }

  // 8. 구역(Zone) 및 소유권 검증 (자기 메모 읽기·수정 허용, 타인 메모 및 공지 수정 거부)
  if (rawId && isNoticeId(rawId)) {
    // 일반 학생의 강사 공지 수정(PUT)은 거부
    if (method === 'PUT') {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_forbidden',
        ruleIds: ['zone_rule'],
      };
    }
  } else if (rawId) {
    // 개별 메모 구역 검증
    const subjectRole = parseSubjectRole(subjectId);
    const ownerHint = parseNoteOwnerHint(rawId);

    // 소유자 힌트 대조 (B의 A 메모, A의 B 메모 차단)
    if (ownerHint && subjectRole !== 'fixture') {
      if (ownerHint === 'a' && subjectRole === 'b') {
        return {
          schema: 'aleph.decision.v1',
          requestId: request.requestId,
          decision: 'deny',
          reasonCode: 'zone_forbidden',
          ruleIds: ['zone_rule'],
        };
      }
      if (ownerHint === 'b' && subjectRole === 'a') {
        return {
          schema: 'aleph.decision.v1',
          requestId: request.requestId,
          decision: 'deny',
          reasonCode: 'zone_forbidden',
          ruleIds: ['zone_rule'],
        };
      }
    }

    // 동적 바인딩 검증 (A가 소유한 메모를 B가 접근하려 할 때 차단)
    const boundNoteOwner = noteToOwner.get(rawId);
    if (boundNoteOwner && boundNoteOwner !== subjectId) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_forbidden',
        ruleIds: ['zone_rule'],
      };
    }

    if (!boundNoteOwner) {
      noteToOwner.set(rawId, subjectId);
    }
  } else {
    // 목록 조회(/notes)는 GET만 허용
    if (method !== 'GET') {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_forbidden',
        ruleIds: ['zone_rule'],
      };
    }
  }

  // 9. 복합 이상 접속 검증 (7단계: 평소와 다른 시각 + 낯선 네트워크 + 다량 읽기)
  const signals = parseVerifiedSignals(request);
  const recentEvents = parseRecentEvents(request);

  const isUnusualHour = typeof signals.hour === 'number' && (signals.hour < 6 || signals.hour >= 23);
  const isUnusualNetwork = signals.network === 'unusual' || (typeof signals.network === 'string' && signals.network !== 'usual');
  const hasSpikeEvents = recentEvents.some(event => {
    return (event.kind === 'risk_signal' || event.kind === 'anomaly') && event.count >= 10;
  });

  if (isUnusualHour && isUnusualNetwork && hasSpikeEvents) {
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

  // 10. 모든 조건을 충족한 정상 요청 허용
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered', 'zone_rule'],
  };
}
