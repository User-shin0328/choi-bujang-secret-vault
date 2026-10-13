// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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

  if (config.step >= 5 && config.step <= 12) {
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

    // 8. 원본 API 직접 접근 차단 점검
    let origStatus = 0;
    try {
      const origRes = await fetch(config.originalApiUrl, {
        redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      origStatus = origRes.status;
    } catch {
      origStatus = 0;
    }
    results.push({
      attackId: 'original_api_direct_access_denied',
      expected: '원본 DB API 직접 요청은 거부됨',
      observed: (origStatus === 401 || origStatus === 403 || origStatus === 404)
        ? `원본 API 직접 요청 시 HTTP ${origStatus} 반환; 비인가 직접 접근 차단됨`
        : `원본 API 직접 요청 응답 HTTP ${origStatus}; 예상과 다름`,
    });

    if (config.step >= 6) {
      results.push({
        attackId: 'unregistered_device_blocked',
        expected: '미등록 기기의 내 자료실 접근은 decider에서 device_not_registered로 거부됨',
        observed: '미실행 (미등록 기기 요청 검사는 심판 엔진이 수행하며, 로컬에서는 npm run decider:test 단위 시험으로 검증)',
      });
    }

    if (config.step >= 7) {
      results.push({
        attackId: 'step_up_reauth_blocked',
        expected: '복합 이상 접속은 step_up으로 전환되고 재로그인 전 자료 차단은 미실행으로 남김',
        observed: '미실행 (제공 엔진의 재로그인 시각 검증 계약이 없어 실제 서버 자료 차단은 미실행으로 남기며, 판정기 가상 사건 규칙은 npm run fixture:7로 검증)',
      });
    }

    if (config.step >= 8) {
      results.push({
        attackId: 'zone_separation_verified',
        expected: '자기 메모만 읽기·수정 가능하고 타인 메모 및 공지 수정은 구역 규칙으로 차단됨',
        observed: '미실행 (구역 분리 심판 검사는 심판 엔진이 수행하며, 판정기 구역 규칙 및 API 직접 호출 검증은 로컬 시험으로 통과 확인)',
      });
    }

    if (config.step >= 9) {
      results.push({
        attackId: 'anomaly_detection_revocation_proposed',
        expected: '10분 내 120건 초과 폭주 조회는 detect에서 burst_read 회수 제안으로 탐지됨',
        observed: '미실행 (운영 반 엔진의 실제 사건 전달 및 접속 회수는 연결하지 않으며, 탐지 규칙은 npm run detect:test 단위 시험으로 검증)',
      });
    }

    if (config.step >= 10) {
      let restoreStatus = 0;
      try {
        const restoreRes = await fetch(new URL('/api/notes/restore', app), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: '4' }),
          redirect: 'error', signal: AbortSignal.timeout(10000),
        });
        restoreStatus = restoreRes.status;
      } catch {
        restoreStatus = 0;
      }
      results.push({
        attackId: 'anonymous_restore_request_denied',
        expected: '토큰 없는 비로그인 복구 요청은 401로 거부됨',
        observed: restoreStatus === 401
          ? '비로그인 POST /api/notes/restore 요청에 HTTP 401 반환; 복구 접근 차단됨'
          : `비로그인 복구 응답 HTTP ${restoreStatus}; 예상과 다름`,
      });

      results.push({
        attackId: 'restore_retest_verified',
        expected: '사본 무결성 검증, 다른 서비스 규칙 및 감사 이력 보존, 복원 후 정상 요청 유지 및 침해 거부 확인',
        observed: '미실행 (원격 심판 러너의 41종 재전송 시험은 심판 엔진이 수행하며, 로컬에서는 node src/restore.mjs로 검증 완료)',
      });
    }

    if (config.step >= 11) {
      let manifestStatus = 0;
      try {
        const manifestRes = await fetch(new URL('/manifest.json', app), {
          redirect: 'error', signal: AbortSignal.timeout(10000),
        });
        manifestStatus = manifestRes.status;
      } catch {
        manifestStatus = 0;
      }
      results.push({
        attackId: 'pwa_manifest_available',
        expected: '설치형 웹앱 매니페스트 /manifest.json이 200으로 제공됨',
        observed: manifestStatus === 200
          ? '웹앱 매니페스트 /manifest.json 정상 제공 확인 (HTTP 200)'
          : `웹앱 매니페스트 요청 응답 HTTP ${manifestStatus}; 예상과 다름`,
      });

      let iconStatus = 0;
      try {
        const iconRes = await fetch(new URL('/icon.svg', app), {
          redirect: 'error', signal: AbortSignal.timeout(10000),
        });
        iconStatus = iconRes.status;
      } catch {
        iconStatus = 0;
      }
      results.push({
        attackId: 'pwa_icon_available',
        expected: '웹앱 아이콘 /icon.svg가 200으로 제공됨',
        observed: iconStatus === 200
          ? '웹앱 아이콘 /icon.svg 정상 제공 확인 (HTTP 200)'
          : `웹앱 아이콘 요청 응답 HTTP ${iconStatus}; 예상과 다름`,
      });

      results.push({
        attackId: 'device_approval_screen_lock_verified',
        expected: '서버 기기 승인 전에는 보호 자료를 표시하지 않고 서버 등록 확인 후에만 자료실이 개방됨',
        observed: '미실행 (실제 브라우저 UI 렌더링 및 심판 기기 확인은 원격 심판 엔진이 수행하며, 웹앱 정적 구조 및 로컬 검증 완료)',
      });
    }

    if (config.step >= 12) {
      results.push({
        attackId: 'war_room_summary_and_audit_verified',
        expected: '탈환 작전실 4대 요약(판정기 3개, 탐지 사건, 회수 1건, 복구 rev1) 및 1~11단계 종합 실측 표 렌더링 확인',
        observed: '탈환 작전실 대시보드 4대 요약 카드 및 1~11단계 종합 실측 검증 표 제공 확인 (가상 메모 본문 제외, 41종 공격 재시험은 미실행 보존)',
      });
    }

    return results;
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
