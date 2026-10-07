export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const desc = alert?.rule?.description ?? '';

  if (level >= 10) {
    return {
      action: 'block',
      confidence: 0.9,
      reason: desc || '비정상적 대량/연속 로그인 실패 공격 탐지',
    };
  }

  if (level >= 5) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: desc || '의심스러운 로그인 실패 또는 비정상 주소 접근',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: desc || '정상 로그인 및 세션 활동',
  };
}
