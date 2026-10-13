// 9단계: 숨어든 도플갱어를 찾고 권한을 거두는 탐지 모듈입니다.
// 가상 사건에서 메모 본문·토큰·실명 등 민감한 비밀값은 일체 읽거나 저장하지 않고,
// 엔진이 검증한 가명 사용자·기기·요청 종류·판정·시각만 화이트리스트 방식으로 정제합니다.

/**
 * 단일 가상 사건 객체에서 비밀값을 배제하고 필요한 속성만 안전하게 추출합니다.
 * @param {unknown} event
 * @returns {{ at: string | null, subject: string | null, deviceId: string | null, method: string | null, decision: string | null } | null}
 */
export function sanitizeEvent(event) {
  if (!event || typeof event !== 'object') return null;

  const raw = /** @type {Record<string, unknown>} */ (event);

  // 1. 발생 시각 (at)
  const at = typeof raw.at === 'string' && raw.at.trim() ? raw.at.trim() : null;

  // 2. 가명 사용자 (subject) - identity.sub 또는 subjectId 등 가명 식별자만 수용
  let subject = null;
  if (raw.identity && typeof raw.identity === 'object') {
    const ident = /** @type {Record<string, unknown>} */ (raw.identity);
    if (typeof ident.sub === 'string' && ident.sub.trim()) {
      subject = ident.sub.trim();
    }
  }
  if (!subject && typeof raw.subjectId === 'string' && raw.subjectId.trim()) {
    subject = raw.subjectId.trim();
  }
  if (!subject && typeof raw.subject === 'string' && raw.subject.trim()) {
    subject = raw.subject.trim();
  }

  // 3. 기기 식별자 (deviceId)
  let deviceId = null;
  if (typeof raw.deviceId === 'string' && raw.deviceId.trim()) {
    deviceId = raw.deviceId.trim();
  } else if (typeof raw.device === 'string' && raw.device.trim()) {
    deviceId = raw.device.trim();
  }

  // 4. 요청 종류 (method / kind)
  let method = null;
  if (typeof raw.method === 'string' && raw.method.trim()) {
    method = raw.method.trim().toUpperCase();
  } else if (typeof raw.kind === 'string' && raw.kind.trim()) {
    method = raw.kind.trim().toUpperCase();
  }

  // 5. 판정 (decision)
  let decision = null;
  if (typeof raw.decision === 'string' && raw.decision.trim()) {
    decision = raw.decision.trim().toLowerCase();
  }

  // 메모 내용(body, content, notes), 토큰(token, bearer), 실명(name, email) 등은 일체 포함하지 않음
  return {
    at,
    subject,
    deviceId,
    method,
    decision,
  };
}

/**
 * 가상 사건 배열을 화이트리스트 방식으로 정제하여 비밀값 없는 사건 목록을 반환합니다.
 * @param {unknown} events
 * @returns {Array<{ at: string | null, subject: string | null, deviceId: string | null, method: string | null, decision: string | null }>}
 */
export function parseEvents(events) {
  if (!Array.isArray(events)) {
    throw new TypeError('invalid_detection_events');
  }
  return events
    .map(e => sanitizeEvent(e))
    .filter(e => e !== null);
}

/**
 * 9단계 탐지 함수 시작점입니다.
 * 정제된 가상 사건을 읽고 이상 패턴을 검사합니다.
 * 이번 요청에서는 입력 정제 처리를 우선 적용하며, 탐지 알고리즘 적용 전 기본 관찰 결과를 반환합니다.
 * @param {unknown} events
 * @returns {{ action: string, reasonCode?: string, subject?: string }}
 */
export function detect(events) {
  // 입력 유효성 검사 및 비밀값 없는 안전한 사건 추출
  const cleanEvents = parseEvents(events);

  // 기본 반환: observe
  return { action: 'observe' };
}
