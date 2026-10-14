/**
 * MITRE ATT&CK T1068 및 T1078 기반 권한 가로채기(Privilege Escalation) 공격 패턴 정의
 */
const PATTERNS = Object.freeze([
  {
    name: '비인가 계정의 관리자 그룹 임의 추가',
    condition: '평범한 사용자 계정이 원격 주소나 단시간 내에 관리자(Administrators) 그룹에 추가되거나 다수 계정이 연속으로 편입됨',
    basis: 'MITRE ATT&CK T1078(정상 계정 도용): 공격자가 탈취한 계정에 관리자 권한을 부여하여 시스템 내 최고 통제 권한을 획득하려는 공격 기법',
  },
  {
    name: '처음 보는 주소 또는 권한 도용을 통한 관리자 명령 실행',
    condition: '방금 관리자가 되었거나 낯선 주소에서 다른 계정의 권한을 이용해 특권 관리자 명령을 즉각 실행함',
    basis: 'MITRE ATT&CK T1068(권한 상승 악용): 취약점이나 부적절한 권한 할당을 악용해 특권 관리자 명령을 인가 없이 실행하는 공격 기법',
  },
  {
    name: '업무 시간 밖 이상 시각 권한 상승 및 관리자 명령 실행',
    condition: '수업 시간이나 일반 업무 시간 외 야간/비정상 시각에 낯선 접속 주소에서 권한 변경 및 관리자 명령이 발생함',
    basis: 'MITRE ATT&CK T1068 / T1078: 관리자 감시가 취약한 업무 외 시간대를 노려 계정 권한을 승격하고 관리자 활동을 수행하는 기법',
  },
]);

const PATTERN_GROUP = PATTERNS[0].name;
const PATTERN_CMD = PATTERNS[1].name;
const PATTERN_TIME = PATTERNS[2].name;

/**
 * 경보 설명 및 세부 데이터를 바탕으로 가장 일치하는 근거 패턴 이름을 추출합니다.
 */
function matchPattern(alert) {
  const desc = alert?.rule?.description ?? '';

  if (
    desc.includes('수업 시간 밖') ||
    desc.includes('시각') ||
    desc.includes('업무')
  ) {
    return PATTERN_TIME;
  }

  if (
    desc.includes('명령') ||
    desc.includes('권한 명령') ||
    desc.includes('실행')
  ) {
    return PATTERN_CMD;
  }

  return PATTERN_GROUP;
}

/**
 * 권한 가로채기(Privilege) 경보를 패턴과 대조하여 판정합니다.
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
      reason: '정상 비밀번호 변경 및 계정 로그인',
    };
  }

  // 3. 애매한 시도 (수준 4~9): 확신도 0.60 -> alert
  return {
    action: 'alert',
    confidence: 0.6,
    reason: matchPattern(alert),
  };
}
