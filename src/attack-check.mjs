// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2, 3, 4].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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

  if (config.step === 4) {
    const results = [];

    // 1. 비로그인 목록 조회 거부 점검
    const listRes = await fetch(new URL('/api/notes', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'anonymous_notes_list_denied',
      expected: '토큰 없는 비로그인 목록 조회는 401로 거부됨',
      observed: listRes.status === 401
        ? '비로그인 GET /api/notes 요청에 HTTP 401 반환; 목록 접근 차단됨'
        : `비로그인 목록 응답 HTTP ${listRes.status}; 예상과 다름`,
    });

    // 2. 비로그인 메모 작성 거부 점검
    const postRes = await fetch(new URL('/api/notes', app), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '공격', body: '비인가 작성' }),
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'anonymous_note_create_denied',
      expected: '토큰 없는 비로그인 메모 추가는 401로 거부됨',
      observed: postRes.status === 401
        ? '비로그인 POST /api/notes 요청에 HTTP 401 반환; 추가 차단됨'
        : `비로그인 작성 응답 HTTP ${postRes.status}; 예상과 다름`,
    });

    // 3. 비로그인 단건 메모 조회 거부 점검
    const itemRes = await fetch(new URL('/api/notes/non-existent-id', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'anonymous_note_item_denied',
      expected: '토큰 없는 비로그인 단건 메모 조회는 401로 거부됨',
      observed: itemRes.status === 401
        ? '비로그인 GET /api/notes/:id 요청에 HTTP 401 반환; 단건 조회 차단됨'
        : `비로그인 단건 응답 HTTP ${itemRes.status}; 예상과 다름`,
    });

    // 4. 비로그인 메모 수정 거부 점검
    const putRes = await fetch(new URL('/api/notes/test-target-id', app), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '변조시도', body: '변조내용' }),
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'anonymous_note_put_denied',
      expected: '토큰 없는 비로그인 메모 수정은 401로 거부됨',
      observed: putRes.status === 401
        ? '비로그인 PUT /api/notes/:id 요청에 HTTP 401 반환; 수정 차단됨'
        : `비로그인 수정 응답 HTTP ${putRes.status}; 예상과 다름`,
    });

    // 5. 비로그인 메모 삭제 거부 점검
    const delRes = await fetch(new URL('/api/notes/test-target-id', app), {
      method: 'DELETE',
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'anonymous_note_delete_denied',
      expected: '토큰 없는 비로그인 메모 삭제는 401로 거부됨',
      observed: delRes.status === 401
        ? '비로그인 DELETE /api/notes/:id 요청에 HTTP 401 반환; 삭제 차단됨'
        : `비로그인 삭제 응답 HTTP ${delRes.status}; 예상과 다름`,
    });

    // 6. 위조 토큰 접근 거부 점검
    const fakeTokenRes = await fetch(new URL('/api/notes', app), {
      headers: { 'Authorization': 'Bearer invalid-token' },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'invalid_token_access_denied',
      expected: '서명되지 않은 위조 토큰 요청은 401로 거부됨',
      observed: fakeTokenRes.status === 401
        ? '위조 토큰 요청에 HTTP 401 반환; 비인가 토큰 차단됨'
        : `위조 토큰 응답 HTTP ${fakeTokenRes.status}; 예상과 다름`,
    });

    // 7. 정적 /data.json 메모 0건 확인
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

    return results;
  }

  if (config.step === 3) {
    const results = [];

    // 1. 비로그인 목록 조회 거부 점검
    const listRes = await fetch(new URL('/api/notes', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'anonymous_notes_list_denied',
      expected: '토큰 없는 비로그인 목록 조회는 401로 거부됨',
      observed: listRes.status === 401
        ? '비로그인 GET /api/notes 요청에 HTTP 401 반환; 목록 접근 차단됨'
        : `비로그인 목록 응답 HTTP ${listRes.status}; 예상과 다름`,
    });

    // 2. 비로그인 메모 작성 거부 점검
    const postRes = await fetch(new URL('/api/notes', app), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '공격', body: '비인가 작성' }),
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'anonymous_note_create_denied',
      expected: '토큰 없는 비로그인 메모 추가는 401로 거부됨',
      observed: postRes.status === 401
        ? '비로그인 POST /api/notes 요청에 HTTP 401 반환; 추가 차단됨'
        : `비로그인 작성 응답 HTTP ${postRes.status}; 예상과 다름`,
    });

    // 3. 비로그인 단건 메모 조회 거부 점검
    const itemRes = await fetch(new URL('/api/notes/non-existent-id', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    results.push({
      attackId: 'anonymous_note_item_denied',
      expected: '토큰 없는 비로그인 단건 메모 조회는 401로 거부됨',
      observed: itemRes.status === 401
        ? '비로그인 GET /api/notes/:id 요청에 HTTP 401 반환; 단건 조회 차단됨'
        : `비로그인 단건 응답 HTTP ${itemRes.status}; 예상과 다름`,
    });

    // 4. 정적 /data.json 메모 0건 확인
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

    return results;
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
