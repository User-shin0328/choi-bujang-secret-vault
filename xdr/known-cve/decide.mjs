export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const desc = alert?.rule?.description ?? '';

  if (level >= 10) {
    return {
      action: 'block',
      confidence: 0.95,
      reason: desc || 'CVE-2021-44228 Log4j 원격 조회 공격 구문 탐지',
    };
  }

  if (level >= 5) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: desc || '취약점 이름/단어 단순 언급 또는 검색',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: desc || '정상 정적 파일 및 공개 화면 요청',
  };
}
