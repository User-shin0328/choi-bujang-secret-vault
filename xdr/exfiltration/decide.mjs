export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const desc = alert?.rule?.description ?? '';

  if (level >= 10) {
    return {
      action: 'block',
      confidence: 0.9,
      reason: desc || '비정상 대용량 전송 및 대량 파일 외부 반출 공격 탐지',
    };
  }

  if (level >= 5) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: desc || '단발성 외부 전송 또는 수업 관련 대용량 작업',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: desc || '정상 공지 및 본인 메모 조회',
  };
}
