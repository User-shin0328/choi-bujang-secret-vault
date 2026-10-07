// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');

  if (config.step === 1) {
    const response = await fetch(new URL('/data.json', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    let visible = false;
    if (response.ok) {
      try {
        const data = await response.json();
        visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
          && data.notes.length > 0;
      } catch {
        // A non-JSON response is a failed check, not a successful deployment.
      }
    }
    return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
      observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
  }

  const results = [];

  const dataResponse = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let notes = null;
  if (dataResponse.ok) {
    try {
      const data = await dataResponse.json();
      notes = data?.notes;
    } catch {
      notes = null;
    }
  }
  const staticNotesEmpty = Array.isArray(notes) && notes.length === 0;
  results.push({
    attackId: 'anonymous_static_note_read',
    expected: '비로그인 정적 파일에서 가상 메모가 보이지 않음',
    observed: staticNotesEmpty
      ? '비로그인 /data.json에서 메모 0건 확인'
      : `비로그인 /data.json에서 메모가 제거되지 않음 (HTTP ${dataResponse.status})`,
  });

  const apiResponse = await fetch(new URL('/api/notes', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let apiNotes = null;
  if (apiResponse.ok) {
    try {
      const data = await apiResponse.json();
      apiNotes = data?.notes;
    } catch {
      apiNotes = null;
    }
  }
  const apiPublic = Array.isArray(apiNotes) && apiNotes.length > 0;
  results.push({
    attackId: 'anonymous_api_note_read',
    expected: '2단계에서는 공개 API의 접근 제어가 아직 없음을 확인',
    observed: apiPublic
      ? '비로그인 /api/notes에서 서버 측 가상 메모가 반환됨'
      : `비로그인 /api/notes에서 가상 메모가 반환되지 않음 (HTTP ${apiResponse.status})`,
  });

  const writeResponse = await fetch(new URL('/api/notes', app), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  results.push({
    attackId: 'unsupported_write',
    expected: '현재 읽기 전용 API에 POST 요청은 거부됨',
    observed: writeResponse.status === 405
      ? 'POST 요청에 HTTP 405 응답; 쓰기 요청 거부됨'
      : `POST 응답 HTTP ${writeResponse.status}; 예상과 다름`,
  });

  return results;
}
