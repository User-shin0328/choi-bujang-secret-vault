export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const desc = alert?.rule?.description ?? '';

  if (level >= 10) {
    return {
      action: 'block',
      confidence: 0.9,
      reason: desc || '임시 폴더 및 미확인 실행 파일 기반 지속성 확보 시도 탐지',
    };
  }

  if (level >= 5) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: desc || '수업 중 예약 작업 또는 서비스 설정 변경',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: desc || '정상 운영체제 업데이트 및 로그인',
  };
}
