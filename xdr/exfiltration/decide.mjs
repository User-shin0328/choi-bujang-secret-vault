/**
 * MITRE ATT&CK T1041 및 T1048 기반 자료 빼돌리기(Exfiltration) 공격 패턴 정의
 */
const PATTERNS = Object.freeze([
  {
    name: '처음 보는 목적지로의 대용량 자료 전송 및 유출',
    condition: '처음 보는 외부 IP 또는 목적지로 짧은 시간 내 대용량 데이터(수백 MB)나 다량의 자료 파일이 반복 전송됨',
    basis: 'MITRE ATT&CK T1041(명령 통로로 유출): 기존 C2 채널이나 외부 연결 통로를 악용해 대량의 내부 자료를 외부로 전송·탈취하는 공격 기법',
  },
  {
    name: '업무 시간 밖 이상 시각 압축 파일 외부 반출',
    condition: '수업 및 일반 업무 시간 외 야간/비정상 시각에 아카이브 압축 파일이 처음 보는 목적지로 외부 전송됨',
    basis: 'MITRE ATT&CK T1048(다른 프로토콜로 유출): 감시가 소홀한 비업무 시간대를 노려 비인가 통신 프로토콜로 압축된 자료를 은밀히 반출하는 공격 기법',
  },
  {
    name: '비인가 포트 및 명령 통로를 통한 자료 반복 전송',
    condition: '평소 사용하지 않는 포트나 명령 제어 통로를 통해 다량의 분할 데이터가 동일 목적지로 연속 유출됨',
    basis: 'MITRE ATT&CK T1041 / T1048: 표준 네트워크 포트나 제어 통로를 우회하여 내부 데이터를 외부 서버로 지속 유출시키는 공격 기법',
  },
]);

const PATTERN_LARGE = PATTERNS[0].name;
const PATTERN_TIME_ARCHIVE = PATTERNS[1].name;
const PATTERN_CHANNEL = PATTERNS[2].name;

/**
 * 경보 설명 및 세부 데이터를 바탕으로 가장 일치하는 근거 패턴 이름을 추출합니다.
 */
function matchPattern(alert) {
  const desc = alert?.rule?.description ?? '';

  if (
    desc.includes('수업 시간 밖') ||
    desc.includes('업무 시간 밖') ||
    desc.includes('압축')
  ) {
    return PATTERN_TIME_ARCHIVE;
  }

  if (
    desc.includes('포트') ||
    desc.includes('명령 통로') ||
    desc.includes('통로')
  ) {
    return PATTERN_CHANNEL;
  }

  return PATTERN_LARGE;
}

/**
 * 자료 빼돌리기(Exfiltration) 경보를 패턴과 대조하여 판정합니다.
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
      reason: '정상 공지 및 본인 메모 조회',
    };
  }

  // 3. 애매한 시도 (수준 4~9): 확신도 0.60 -> alert
  return {
    action: 'alert',
    confidence: 0.6,
    reason: matchPattern(alert),
  };
}
