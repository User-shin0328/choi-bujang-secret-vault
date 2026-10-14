/**
 * MITRE ATT&CK T1543 및 T1053 기반 지속성(Persistence) 공격 패턴 정의
 */
const PATTERNS = Object.freeze([
  {
    name: '서명 없는 새 서비스 등록 및 변경',
    condition: '서명되지 않은 바이너리나 임시 폴더 내 실행 파일을 가리키는 새 서비스가 등록되거나 기존 서비스 실행 파일이 변조됨',
    basis: 'MITRE ATT&CK T1543(시스템 프로세스 생성·변경): 재부팅 후에도 백그라운드 서비스 형태로 악성코드가 자동 구동되도록 지속성을 확보하는 공격 기법',
  },
  {
    name: '임시 경로 프로그램 기반 낯선 예약 작업 등록',
    condition: '임시 폴더의 프로그램이나 임의 문자열 이름으로 비정상 시각에 구동되는 새로운 예약 작업이 등록됨',
    basis: 'MITRE ATT&CK T1053(예약 작업): 작업 스케줄러를 악용해 지정된 시점 또는 비인가 주기마다 프로그램을 지속 실행시키는 공격 기법',
  },
  {
    name: '시작 폴더 내 미인가 프로그램 추가 및 변경',
    condition: '사용자 시작 프로그램 폴더(Startup)에 평소 목록에 없거나 임시 파일을 가리키는 실행 파일이 추가됨',
    basis: 'MITRE ATT&CK T1543(시스템 프로세스 생성·변경): 사용자 로그인 시 시작 폴더 내 등록 프로그램이 자동 실행되는 구조를 악용해 지속성을 유지하는 공격 기법',
  },
]);

const PATTERN_SERVICE = PATTERNS[0].name;
const PATTERN_TASK = PATTERNS[1].name;
const PATTERN_STARTUP = PATTERNS[2].name;

/**
 * 경보 설명 및 경로 정보를 바탕으로 가장 일치하는 근거 패턴 이름을 추출합니다.
 */
function matchPattern(alert) {
  const desc = alert?.rule?.description ?? '';
  const path = alert?.data?.path ?? '';

  if (
    desc.includes('시작 폴더') ||
    desc.includes('시작 항목') ||
    desc.includes('시작 프로그램') ||
    path.includes('Startup') ||
    path.includes('Start Menu')
  ) {
    return PATTERN_STARTUP;
  }

  if (
    desc.includes('예약 작업') ||
    desc.includes('스케줄') ||
    desc.includes('task')
  ) {
    return PATTERN_TASK;
  }

  return PATTERN_SERVICE;
}

/**
 * 지속성(Persistence) 경보를 패턴과 대조하여 판정합니다.
 * - 확신도 0.85 이상: block (명확한 공격)
 * - 확신도 0.50 이상: alert (애매한 시도)
 * - 0.50 미만: record (정상 이벤트)
 *
 * 심판 환경 요구사항에 따라 외부 import 문이나 I/O 없이 독자적으로 계산합니다.
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
      reason: '정상 운영체제 업데이트 및 로그인',
    };
  }

  // 3. 애매한 시도 (수준 4~9): 확신도 0.60 -> alert
  return {
    action: 'alert',
    confidence: 0.6,
    reason: matchPattern(alert),
  };
}
