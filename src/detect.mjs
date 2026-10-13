// 9단계: 숨어든 도플갱어를 찾고 권한을 거두는 탐지 모듈입니다.
// 가상 사건에서 메모 본문·토큰·실명 등 민감한 비밀값은 일체 읽거나 저장하지 않고,
// 엔진이 검증한 가명 사용자·기기·요청 종류·판정·시각·네트워크 신호만 화이트리스트 방식으로 정제합니다.

/**
 * 단일 가상 사건 객체에서 비밀값을 배제하고 필요한 속성만 안전하게 추출합니다.
 * @param {unknown} event
 * @returns {{ at: string | null, subject: string | null, deviceId: string | null, method: string | null, decision: string | null, network: string | null, region: string | null } | null}
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

  // 6. 네트워크 및 지역 신호 (signals 또는 직접 속성)
  let network = null;
  let region = null;
  if (typeof raw.network === 'string' && raw.network.trim()) {
    network = raw.network.trim().toLowerCase();
  }
  if (typeof raw.region === 'string' && raw.region.trim()) {
    region = raw.region.trim().toLowerCase();
  }
  if (raw.signals && typeof raw.signals === 'object') {
    const sig = /** @type {Record<string, unknown>} */ (raw.signals);
    if (!network && typeof sig.network === 'string' && sig.network.trim()) {
      network = sig.network.trim().toLowerCase();
    }
    if (!region && typeof sig.region === 'string' && sig.region.trim()) {
      region = sig.region.trim().toLowerCase();
    }
  }

  // 메모 내용(body, content, notes), 토큰(token, bearer), 실명(name, email) 등은 일체 포함하지 않음
  return {
    at,
    subject,
    deviceId,
    method,
    decision,
    network,
    region,
  };
}

/**
 * 가상 사건 배열을 화이트리스트 방식으로 정제하여 비밀값 없는 사건 목록을 반환합니다.
 * @param {unknown} events
 * @returns {Array<{ at: string | null, subject: string | null, deviceId: string | null, method: string | null, decision: string | null, network: string | null, region: string | null }>}
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
 * 평소와 다른 네트워크와 10분 구간 내 120건을 초과하는 갑작스러운 다량 조회가 함께 나타날 때만 권한 회수를 제안합니다.
 * 지역 하나만으로는 확정하지 않으며, 120건 이하의 정상 사건은 관찰(observe) 상태를 유지합니다.
 * @param {unknown} events
 * @returns {{ action: 'observe' | 'propose_revocation', reasonCode?: string, subject?: string }}
 */
export function detect(events) {
  const cleanEvents = parseEvents(events);

  // 사용자별 유효한 GET 조회 사건 수집
  const userMap = new Map();

  for (const item of cleanEvents) {
    if (!item.subject || !item.at) continue;
    // GET 요청 또는 조회 사건만 집계
    if (item.method && item.method !== 'GET') continue;

    const time = new Date(item.at).getTime();
    if (Number.isNaN(time)) continue;

    let list = userMap.get(item.subject);
    if (!list) {
      list = [];
      userMap.set(item.subject, list);
    }
    list.push({ time, event: item });
  }

  // 10분 = 600,000ms
  const WINDOW_MS = 10 * 60 * 1000;
  const BURST_THRESHOLD = 120; // 120건을 넘을 때(121건 이상)만 탐지

  for (const [subject, list] of userMap.entries()) {
    // 시간순 정렬
    list.sort((a, b) => a.time - b.time);

    // 슬라이딩 윈도우로 10분 구간 내 120건 초과 여부 검사
    let left = 0;
    for (let right = 0; right < list.length; right++) {
      while (list[right].time - list[left].time > WINDOW_MS) {
        left++;
      }

      const count = right - left + 1;
      if (count > BURST_THRESHOLD) {
        // 구간 내 사건들 분석
        const windowItems = list.slice(left, right + 1);

        // 사건들에 명시적 네트워크 신호가 포함되어 있는 경우 검사
        const hasExplicitNetwork = windowItems.some(i => i.event.network !== null);
        if (hasExplicitNetwork) {
          const hasUnusualNetwork = windowItems.some(i => i.event.network === 'unusual' || i.event.network !== 'usual');
          if (!hasUnusualNetwork) {
            // 네트워크가 모두 평소 네트워크('usual')이면 다량이어도 회수 제안하지 않고 관찰 유지
            continue;
          }
        }

        // 지역 하나만으로 확정하지 않으며, 10분 내 120건 초과 다량 조회 + 복합 조건 충족 시 회수 제안
        return {
          action: 'propose_revocation',
          reasonCode: 'burst_read',
          subject,
        };
      }
    }
  }

  return { action: 'observe' };
}
