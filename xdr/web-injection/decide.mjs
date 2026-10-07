export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const desc = alert?.rule?.description ?? '';

  if (level >= 10) {
    return {
      action: 'block',
      confidence: 0.9,
      reason: desc || 'SQL Injection, XSS 및 경로 순회 반복 공격 탐지',
    };
  }

  if (level >= 5) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: desc || '단발성 특수문자 또는 수업 관련 단어 입력',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: desc || '정상 웹 요청 및 화면 조회',
  };
}
