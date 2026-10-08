/**
 * MITRE ATT&CK T1190(외부 공개 앱 악용) 기반 웹 주입 공격 패턴 정의
 */
const PATTERNS = Object.freeze([
  {
    name: '요청 인자 내 SQL 구문 연속 주입',
    condition: 'URL 쿼리 또는 요청 인자에 SQL 구문(SELECT, OR, 따옴표 등) 조작 및 연결 표기가 동일 출발 주소에서 10회 이상 반복됨',
    basis: 'MITRE ATT&CK T1190(외부 공개 앱 악용): 웹 애플리케이션의 입력값 검증 취약점을 이용해 백엔드 데이터베이스를 비정상 조회·조작하려는 SQL 주입 기법',
  },
  {
    name: '스크립트 태그 및 코드 삽입 표기 반복',
    condition: 'URL 쿼리 또는 검색어 인자에 스크립트 태그(<script>) 및 스크립트 삽입 표식이 동일 출발 주소에서 연속적으로 포함되어 유입됨',
    basis: 'MITRE ATT&CK T1190(외부 공개 앱 악용): 웹 애플리케이션에 악성 클라이언트 스크립트를 삽입하여 브라우저 실행 흐름을 변조하려는 크로스 사이트 스크립팅 기법',
  },
  {
    name: '경로 거슬러 올라가기(../)를 통한 파일 경로 이탈 반복',
    condition: '파일 요청 경로 또는 매개변수에 상위 디렉터리 이동 표기(../) 및 경로 이탈 표식이 동일 출발 주소에서 다회 반복됨',
    basis: 'MITRE ATT&CK T1190(외부 공개 앱 악용): 파일 참조 인터페이스를 악용해 웹 루트 디렉터리를 벗어나 임의 파일에 접근하려는 경로 순회 기법',
  },
]);

const PATTERN_SQL = PATTERNS[0].name;
const PATTERN_SCRIPT = PATTERNS[1].name;
const PATTERN_PATH = PATTERNS[2].name;

/**
 * 경보 설명 및 URL 정보를 바탕으로 가장 일치하는 근거 패턴 이름을 추출합니다.
 */
function matchPattern(alert) {
  const desc = alert?.rule?.description ?? '';
  const url = alert?.data?.url ?? '';

  if (desc.includes('스크립트') || desc.includes('script') || url.includes('script')) {
    return PATTERN_SCRIPT;
  }
  if (desc.includes('경로') || desc.includes('거슬러') || desc.includes('이탈') || url.includes('path') || url.includes('up')) {
    return PATTERN_PATH;
  }
  return PATTERN_SQL;
}

/**
 * 웹 주입 공격 경보를 패턴과 대조하여 판단을 내립니다.
 * - 확신도 0.85 이상: block (명확한 공격)
 * - 확신도 0.50 이상: alert (애매한 시도)
 * - 0.50 미만: record (정상 이벤트)
 *
 * 외부 파일/패키지 import 및 I/O 없이 자체적으로 계산하여 반환합니다.
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;

  // 1. 명확한 공격 (수준 10 이상): 확신도 0.90 -> block
  if (level >= 10) {
    return {
      action: 'block',
      confidence: 0.9,
      reason: matchPattern(alert),
    };
  }

  // 2. 정상 이벤트 (수준 3 이하): 확신도 0.10 -> record
  if (level <= 3) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: '정상 웹 요청 및 화면 조회',
    };
  }

  // 3. 애매한 시도 (수준 4~9): 확신도 0.65 -> alert
  return {
    action: 'alert',
    confidence: 0.65,
    reason: matchPattern(alert),
  };
}
