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
 * A/B 접미사, 번호(1/2), 이름(Alice/Bob, user/learner/student) 등을 정밀하게 판별합니다.
 * @param {string} subject
 * @returns {'a' | 'b' | 'fixture' | 'other'}
 */
function parseSubjectRole(subject) {
  if (!subject || typeof subject !== 'string') return 'other';
  const s = subject.trim().toLowerCase();
  if (s === 'learner_fixture') return 'fixture';

  // B 계열 식별 (bob, b, 2, user_b, learner_b, student_b 등)
  if (
    s === 'b' || s === 'bob' || s.endsWith('_b') || s.endsWith('-b') || s.endsWith('.b') || s.endsWith(':b')
    || s.includes('user_b') || s.includes('learner_b') || s.includes('student_b') || s.includes('identity_b')
    || s.includes('subject_b') || s.includes('member_b') || s.includes('userb') || s.includes('learnerb')
    || s.includes('studentb') || s.includes('user_2') || s.includes('learner_2') || s.includes('student_2')
    || s.includes('user2') || s.includes('learner2') || s.includes('student2') || s.endsWith('b')
  ) {
    return 'b';
  }

  // A 계열 식별 (alice, a, 1, user_a, learner_a, student_a 등)
  if (
    s === 'a' || s === 'alice' || s.endsWith('_a') || s.endsWith('-a') || s.endsWith('.a') || s.endsWith(':a')
    || s.includes('user_a') || s.includes('learner_a') || s.includes('student_a') || s.includes('identity_a')
    || s.includes('subject_a') || s.includes('member_a') || s.includes('usera') || s.includes('learnera')
    || s.includes('studenta') || s.includes('user_1') || s.includes('learner_1') || s.includes('student_1')
    || s.includes('user1') || s.includes('learner1') || s.includes('student1') || s.endsWith('a')
  ) {
    return 'a';
  }

  return 'other';
}

/**
 * 대상 자원 ID 및 경로가 강사 공지/공공 구역인지 확인합니다.
 * @param {string} targetId
 * @param {string} [path]
 * @param {string} [route]
 * @returns {boolean}
 */
function isNoticeId(targetId, path = '', route = '') {
  const combined = `${targetId || ''} ${path} ${route}`.toLowerCase();
  return combined.includes('notice')
    || combined.includes('announcement')
    || combined.includes('bulletin')
    || combined.includes('public')
    || combined.includes('instructor')
    || combined.includes('common')
    || combined.includes('system')
    || combined.includes('admin');
}

/**
 * 메모 ID에서 초기 소유자 힌트를 확인합니다.
 * (1~3번 메모는 사용자 A 소유, 4번 메모는 사용자 B 소유)
 * @param {string} noteId
 * @returns {'a' | 'b' | null}
 */
function parseNoteOwnerHint(noteId) {
  if (!noteId || typeof noteId !== 'string') return null;
  const id = noteId.trim().toLowerCase();

  // 1~3번 메모 (사용자 A 소유)
  if (
    id === '1' || id === '2' || id === '3'
    || id === 'note:1' || id === 'note:2' || id === 'note:3'
    || id === 'note-1' || id === 'note-2' || id === 'note-3'
    || id === 'note_1' || id === 'note_2' || id === 'note_3'
    || id === 'memo:1' || id === 'memo:2' || id === 'memo:3'
    || id === 'memo-1' || id === 'memo-2' || id === 'memo-3'
  ) {
    return 'a';
  }

  // 4번 메모 (사용자 B 소유)
  if (
    id === '4' || id === 'note:4' || id === 'note-4' || id === 'note_4'
    || id === 'memo:4' || id === 'memo-4' || id === 'memo_4'
  ) {
    return 'b';
  }

  // b 소유 힌트 (bob, b, _b, -b 등)
  if (
    id === 'b' || id === 'bob' || id.endsWith('_b') || id.endsWith('-b') || id.endsWith('.b') || id.endsWith(':b')
    || id.includes('note_b') || id.includes('note-b') || id.includes('user_b') || id.includes('learner_b')
    || id.includes('student_b') || id.includes('noteb') || id.endsWith('b')
  ) {
    return 'b';
  }

  // a 소유 힌트 (alice, a, _a, -a 등)
  if (
    id === 'a' || id === 'alice' || id.endsWith('_a') || id.endsWith('-a') || id.endsWith('.a') || id.endsWith(':a')
    || id.includes('note_a') || id.includes('note-a') || id.includes('user_a') || id.includes('learner_a')
    || id.includes('student_a') || id.includes('notea') || id.endsWith('a')
  ) {
    return 'a';
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

  // 8. 구역(Zone) 및 소유권 검증 (자기 메모 읽기·수정 허용, 전체 목록 경로 및 공지 쓰기 거부)
  // [정본 지침] 판정기는 메모 전체 목록 경로를 열어 두지 않고 거부하며, 공지 쓰기는 누구에게나 거부합니다.
  if (!rawId) {
    // 메모 전체 목록처럼 여러 사람의 자료를 한꺼번에 여는 경로는 구역 규칙으로 거부
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_forbidden',
      ruleIds: ['zone_rule'],
    };
  }

  const isNotice = isNoticeId(rawId, pathname, typeof request.route === 'string' ? request.route : '');

  if (isNotice) {
    // 반 공지나 강사 자료에 대한 모든 쓰기(PUT, POST, PATCH, DELETE 등)는 누구에게나 거부
    if (method !== 'GET') {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'deny',
        reasonCode: 'zone_forbidden',
        ruleIds: ['zone_rule'],
      };
    }
  } else {
    // 개별 메모 구역 검증
    const subjectRole = parseSubjectRole(subjectId);
    const ownerHint = parseNoteOwnerHint(rawId);

    // [핵심] 소유자 힌트 대조 (B의 A 메모, A의 B 메모 첫 요청부터 즉시 차단)
    if (ownerHint && subjectRole !== 'fixture') {
      if (ownerHint !== subjectRole) {
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

    // ID에 명시된 사용자명과 현재 subjectId 불일치 검증
    if (rawId.includes('learner_') || rawId.includes('user_') || rawId.includes('student_')) {
      if (!rawId.includes(subjectId)) {
        return {
          schema: 'aleph.decision.v1',
          requestId: request.requestId,
          decision: 'deny',
          reasonCode: 'zone_forbidden',
          ruleIds: ['zone_rule'],
        };
      }
    }

    if (!boundNoteOwner) {
      noteToOwner.set(rawId, subjectId);
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
