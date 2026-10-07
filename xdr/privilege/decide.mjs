export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const desc = alert?.rule?.description ?? '';

  if (level >= 10) {
    return {
      action: 'block',
      confidence: 0.9,
      reason: desc || '원격 주소 기반 관리자 그룹 추가 및 관리자 명령 실행 탐지',
    };
  }

  if (level >= 5) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: desc || '단발성 권한 상승 시도 또는 비관리자 그룹 변경',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: desc || '정상 비밀번호 변경 및 계정 로그인',
  };
}
