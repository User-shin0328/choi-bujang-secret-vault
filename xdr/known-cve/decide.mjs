/**
 * MITRE ATT&CK T1190(외부 공개 앱 악용) 및 CVE-2021-44228 기반 공격 패턴 정의
 */
const PATTERNS = Object.freeze([
  {
    name: '요청 머리글 내 원격 조회 구문 삽입',
    condition: 'HTTP 요청 머리글(User-Agent 등)에 JNDI 원격 자원 조회 구문(${jndi:...})이 포함되어 유입됨',
    basis: 'MITRE ATT&CK T1190(외부 공개 앱 악용): CVE-2021-44228 취약점을 악용해 서버 로깅 과정에서 원격 조회를 유발하려는 공격 기법',
  },
  {
    name: '요청 인자 내 원격 조회 구문 삽입',
    condition: 'URL 쿼리 매개변수 또는 요청 인자값에 JNDI 원격 조회 구문(${jndi:...})이 직접 포함되어 유입됨',
    basis: 'MITRE ATT&CK T1190(외부 공개 앱 악용): 공개 웹 서비스의 검색·로그인 입력 인자를 통해 CVE-2021-44228 원격 코드 실행을 유도하는 공격 기법',
  },
  {
    name: '취약점 점검 흔적 및 원격 조회 구문 반복 유입',
    condition: '상태 점검 경로(probe 등) 또는 자동화 점검 흔적과 함께 JNDI 원격 조회 구문이 동일 출발 주소에서 반복 유입됨',
    basis: 'MITRE ATT&CK T1190(외부 공개 앱 악용): 취약점 탐색 도구로 CVE-2021-44228 취약 여부를 스캔하고 원격 조회를 연속 시도하는 공격 기법',
  },
]);

const PATTERN_HEADER = PATTERNS[0].name;
const PATTERN_PARAM = PATTERNS[1].name;
const PATTERN_SCAN = PATTERNS[2].name;

/**
 * 경보 설명 및 세부 데이터를 바탕으로 가장 일치하는 근거 패턴 이름을 추출합니다.
 */
function matchPattern(alert) {
  const desc = alert?.rule?.description ?? '';
  const data = alert?.data ?? {};
  const useragent = data.useragent ?? '';
  const url = data.url ?? '';

  if (
    desc.includes('점검') ||
    desc.includes('반복') ||
    desc.includes('도구') ||
    url.includes('probe') ||
    url.includes('check') ||
    (data.count && Number(data.count) > 1)
  ) {
    return PATTERN_SCAN;
  }

  if (
    desc.includes('머리글') ||
    useragent.includes('jndi') ||
    useragent.includes('${')
  ) {
    return PATTERN_HEADER;
  }

  return PATTERN_PARAM;
}

/**
 * CVE-2021-44228 경보를 패턴과 대조하여 판정합니다.
 * - 확신도 0.85 이상: block (명확한 공격)
 * - 확신도 0.50 이상: alert (애매한 시도)
 * - 0.50 미만: record (정상 이벤트)
 *
 * 심판 환경 요구사항에 따라 외부 import 문이나 I/O 없이 독자적으로 계산합니다.
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;

  // 1. 명확한 공격 (수준 10 이상): 확신도 0.95 -> block
  if (level >= 10) {
    return {
      action: 'block',
      confidence: 0.95,
      reason: matchPattern(alert),
    };
  }

  // 2. 정상 이벤트 (수준 3 이하): 확신도 0.10 -> record
  if (level <= 3) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: '정상 정적 파일 및 공개 화면 요청',
    };
  }

  // 3. 애매한 시도 (수준 4~9): 확신도 0.60 -> alert
  return {
    action: 'alert',
    confidence: 0.6,
    reason: matchPattern(alert),
  };
}
