// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
const DEVICE_STATUS_LABELS = {
  compliant: '보안 기준 충족',
  noncompliant: '보안 기준 미충족',
  unknown: '확인 불가',
};

const SESSION_STATUS_LABELS = {
  active: '활성',
  expired: '만료',
  revoked: '철회됨',
  unknown: '확인 불가',
};

const MODE_LABELS = {
  demo: '예제 자료',
  disconnected: '연결 없음',
  connected: '연결됨',
  unknown: '확인 불가',
};

const DECISION_LABELS = {
  allow: {
    label: '접근 허용',
    note: '정책상 접근이 허용되었습니다. (실제 앱 접속 성공을 보장하지는 않습니다)',
  },
  deny: {
    label: '접근 거부',
    note: '정책상 접근이 거부되었습니다.',
  },
  challenge: {
    label: '추가 인증 또는 확인 필요',
    note: '추가 확인이 필요하며, 앱이 확인 절차를 대신하지 않습니다.',
  },
  unknown: {
    label: '판정 확인 불가',
    note: '판정을 확인할 수 없으며 정상 또는 접근이 허용되지 않았습니다.',
  },
};

const ACCESS_STATUS_LABELS = {
  allowed: '접근 허용',
  denied: '접근 거부',
  unknown: '확인 불가',
};

const EVENT_KIND_LABELS = {
  access: '접속',
  xdr: 'XDR 경보',
};

export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const container = document.createElement('div');
      container.className = 'student-identity-view';
      container.setAttribute('data-student-section', 'identity');

      // 1. 모드 안내 (loading, error, ok 모든 상태에서 전달받은 mode 표시)
      const currentMode = (me && me.mode) || (devices && devices.mode) || (sessions && sessions.mode) || 'unknown';
      const modeText = MODE_LABELS[currentMode] || '확인 불가';
      const modeEl = document.createElement('div');
      modeEl.className = 'student-mode-badge';
      modeEl.textContent = `모드: ${modeText}`;
      container.appendChild(modeEl);

      // 2. loading 상태 처리
      if (!me || me.status === 'loading') {
        const loadingEl = document.createElement('p');
        loadingEl.className = 'student-status-loading';
        loadingEl.textContent = '불러오는 중';
        container.appendChild(loadingEl);
        return container;
      }

      // 3. error 상태 처리 (이전 사용자 정보가 남지 않도록 에러 메시지만 포함)
      if (me.status === 'error') {
        const errorEl = document.createElement('p');
        errorEl.className = 'student-status-error';
        const msg = me.error && me.error.message ? me.error.message : '확인 불가';
        errorEl.textContent = `연결 실패: ${msg}`;
        container.appendChild(errorEl);
        return container;
      }

      // 4. ok 상태 처리: me.data 읽기
      const userData = (me.data && me.data.user) || {};
      const deviceData = (me.data && me.data.device) || {};
      const sessionData = (me.data && me.data.session) || {};

      // 사용자 정보 (label 및 id)
      const userP = document.createElement('p');
      userP.className = 'student-identity-user';
      userP.setAttribute('data-student-field', 'user');
      const userLabel = userData.label || userData.id || '확인 불가';
      userP.textContent = userData.id && userData.label
        ? `사용자: ${userData.label} (${userData.id})`
        : `사용자: ${userLabel}`;
      container.appendChild(userP);

      // 기기 정보 (label, id, status: compliant/noncompliant/unknown)
      const deviceP = document.createElement('p');
      deviceP.className = 'student-identity-device';
      deviceP.setAttribute('data-student-field', 'device');
      const devStatusRaw = deviceData.status || 'unknown';
      const devStatusText = DEVICE_STATUS_LABELS[devStatusRaw] || '확인 불가';
      const devLabel = deviceData.label || deviceData.id || '확인 불가';
      const devIdPart = deviceData.id && deviceData.label ? ` (${deviceData.id})` : '';
      deviceP.textContent = `기기: ${devLabel}${devIdPart} · 상태: ${devStatusText} (${devStatusRaw})`;
      if (devStatusRaw === 'noncompliant') {
        deviceP.className = 'student-identity-device status-warning';
        deviceP.setAttribute('data-student-status', 'noncompliant');
      }
      container.appendChild(deviceP);

      // 세션 정보 (id, status: active/expired/revoked/unknown)
      const sessionP = document.createElement('p');
      sessionP.className = 'student-identity-session';
      sessionP.setAttribute('data-student-field', 'session');
      const sessStatusRaw = sessionData.status || 'unknown';
      const sessStatusText = SESSION_STATUS_LABELS[sessStatusRaw] || '확인 불가';
      const sessId = sessionData.id || '확인 불가';
      sessionP.textContent = `세션: ${sessId} · 상태: ${sessStatusText} (${sessStatusRaw})`;
      if (sessStatusRaw === 'expired' || sessStatusRaw === 'revoked') {
        sessionP.className = 'student-identity-session status-alert';
        sessionP.setAttribute('data-student-status', sessStatusRaw);
      }
      container.appendChild(sessionP);

      // 5. devices / sessions 보조 상태 처리
      if (devices && devices.status === 'error') {
        const devErr = document.createElement('p');
        devErr.className = 'student-status-error';
        devErr.textContent = `기기 목록 연결 실패: ${devices.error && devices.error.message ? devices.error.message : '확인 불가'}`;
        container.appendChild(devErr);
      }

      if (sessions && sessions.status === 'error') {
        const sessErr = document.createElement('p');
        sessErr.className = 'student-status-error';
        sessErr.textContent = `세션 목록 연결 실패: ${sessions.error && sessions.error.message ? sessions.error.message : '확인 불가'}`;
        container.appendChild(sessErr);
      }

      return container;
    },
    renderDecision({ status, mode, data, error, appId } = {}) {
      const container = document.createElement('div');
      container.className = 'student-decision-view';
      container.setAttribute('data-student-section', 'decision');

      // 1. 모드 안내 (loading, error, ok, idle 모든 상태에서 모드 표시)
      const currentMode = mode || 'unknown';
      const modeText = MODE_LABELS[currentMode] || '확인 불가';
      const modeEl = document.createElement('div');
      modeEl.className = 'student-mode-badge';
      modeEl.textContent = `모드: ${modeText}`;
      container.appendChild(modeEl);

      // 2. idle: 요청 전 상태
      if (!status || status === 'idle') {
        const idleEl = document.createElement('p');
        idleEl.className = 'student-decision-idle';
        idleEl.textContent = '앱을 골라 접속을 요청하세요.';
        container.appendChild(idleEl);
        return container;
      }

      // 3. loading: 판정 확인 중 상태
      if (status === 'loading') {
        const loadingEl = document.createElement('p');
        loadingEl.className = 'student-decision-loading';
        loadingEl.textContent = appId ? `${appId} 판정 확인 중…` : '판정 확인 중…';
        container.appendChild(loadingEl);
        return container;
      }

      // 4. error: 요청 실패 상태 (거부 판정과 구분 및 허용으로 읽히지 않게 처리)
      if (status === 'error') {
        const errorWrap = document.createElement('div');
        errorWrap.className = 'student-decision-error status-alert';
        errorWrap.setAttribute('data-student-status', 'error');

        const errP = document.createElement('p');
        const msg = error && error.message ? error.message : '확인 불가';
        errP.textContent = `요청 실패: ${msg}`;
        errorWrap.appendChild(errP);

        const noticeP = document.createElement('p');
        noticeP.className = 'status-note';
        noticeP.textContent = '요청 실패는 거부 판정이 아니며, 정상 또는 접근이 허용되지 않았습니다.';
        errorWrap.appendChild(noticeP);

        container.appendChild(errorWrap);
        return container;
      }

      // 5. ok: 판정 수신 상태
      const decisionData = data || {};
      const targetAppId = decisionData.appId || appId || '알 수 없음';
      const rawDecision = decisionData.decision;
      const isKnown = ['allow', 'deny', 'challenge', 'unknown'].includes(rawDecision);
      const effectiveDecision = isKnown ? rawDecision : 'unknown';
      const decisionInfo = DECISION_LABELS[effectiveDecision];

      // 대상 앱 표시
      const appP = document.createElement('p');
      appP.className = 'student-decision-app';
      appP.setAttribute('data-student-field', 'appId');
      appP.textContent = `업무 앱: ${targetAppId}`;
      container.appendChild(appP);

      // 판정 결과 표시 (한국어 뜻과 원래 코드값 함께 표시)
      const decP = document.createElement('p');
      decP.className = `student-decision-result decision-${effectiveDecision}`;
      decP.setAttribute('data-student-decision', effectiveDecision);
      decP.textContent = `판정: ${decisionInfo.label} (${effectiveDecision})`;
      if (effectiveDecision === 'deny' || effectiveDecision === 'unknown') {
        decP.className += ' status-alert';
      } else if (effectiveDecision === 'challenge') {
        decP.className += ' status-warning';
      }
      container.appendChild(decP);

      // 판정 부가 설명
      const noteP = document.createElement('p');
      noteP.className = 'student-decision-note';
      noteP.textContent = decisionInfo.note;
      container.appendChild(noteP);

      // 판정 이유 (reason)
      const reasonP = document.createElement('p');
      reasonP.className = 'student-decision-reason';
      reasonP.setAttribute('data-student-field', 'reason');
      reasonP.textContent = `판정 이유: ${decisionData.reason || '사유 정보 없음'}`;
      container.appendChild(reasonP);

      // 판정 시각 (checkedAt)
      const timeP = document.createElement('p');
      timeP.className = 'student-decision-time';
      timeP.setAttribute('data-student-field', 'checkedAt');
      timeP.textContent = `판정 시각: ${decisionData.checkedAt || '확인 불가'}`;
      container.appendChild(timeP);

      return container;
    },
    renderEvents({ status, mode, data, error } = {}) {
      const container = document.createElement('div');
      container.className = 'student-events-view';
      container.setAttribute('data-student-section', 'events');

      // 1. 모드 안내 (loading, error, ok 모든 상태에서 전달받은 mode 표시)
      const currentMode = mode || 'unknown';
      const modeText = MODE_LABELS[currentMode] || '확인 불가';
      const modeEl = document.createElement('div');
      modeEl.className = 'student-mode-badge';
      modeEl.textContent = `모드: ${modeText}`;
      container.appendChild(modeEl);

      // 2. loading 상태 처리
      if (!status || status === 'loading') {
        const loadingEl = document.createElement('p');
        loadingEl.className = 'student-events-loading';
        loadingEl.textContent = '보안 기록을 불러오는 중…';
        container.appendChild(loadingEl);
        return container;
      }

      // 3. error 상태 처리 (빈 목록과 명확히 구분)
      if (status === 'error') {
        const errorWrap = document.createElement('div');
        errorWrap.className = 'student-events-error status-alert';
        errorWrap.setAttribute('data-student-status', 'error');

        const errP = document.createElement('p');
        const msg = error && error.message ? error.message : '확인 불가';
        errP.textContent = `기록을 불러오지 못했습니다: ${msg}`;
        errorWrap.appendChild(errP);

        container.appendChild(errorWrap);
        return container;
      }

      // 4. ok 상태: data가 배열인지 확인
      const eventsList = Array.isArray(data) ? data : [];
      if (eventsList.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.className = 'student-events-empty';
        emptyP.textContent = '표시할 기록이 없습니다.';
        container.appendChild(emptyP);
        return container;
      }

      // at 기준 최신순 정렬 (원본 배열 복사)
      const sortedEvents = [...eventsList].sort((a, b) => {
        const timeA = a.at ? Date.parse(a.at) : 0;
        const timeB = b.at ? Date.parse(b.at) : 0;
        return timeB - timeA;
      });

      // 필터 및 상세 선택 상태 (함수 스코프 내 클로저 변수)
      let currentKindFilter = 'all';
      let currentAppFilter = 'all';
      let currentAccessFilter = 'all';
      let selectedEventId = null;

      // 5. 필터 컨트롤 UI 생성
      const filterBar = document.createElement('div');
      filterBar.className = 'student-events-filters';

      // (1) 기록 종류 필터
      const kindLabel = document.createElement('label');
      kindLabel.className = 'student-filter-label';
      kindLabel.textContent = '기록 종류: ';
      const kindSelect = document.createElement('select');
      kindSelect.setAttribute('aria-label', '기록 종류');
      const kindAllOpt = document.createElement('option');
      kindAllOpt.value = 'all';
      kindAllOpt.textContent = '전체 (all)';
      kindSelect.appendChild(kindAllOpt);
      const uniqueKinds = [...new Set(sortedEvents.map(e => e.kind).filter(Boolean))];
      for (const k of uniqueKinds) {
        const opt = document.createElement('option');
        opt.value = k;
        const kText = EVENT_KIND_LABELS[k] || k;
        opt.textContent = `${kText} (${k})`;
        kindSelect.appendChild(opt);
      }
      kindLabel.appendChild(kindSelect);
      filterBar.appendChild(kindLabel);

      // (2) 업무 앱 필터
      const appLabel = document.createElement('label');
      appLabel.className = 'student-filter-label';
      appLabel.textContent = '업무 앱: ';
      const appSelect = document.createElement('select');
      appSelect.setAttribute('aria-label', '업무 앱');
      const appAllOpt = document.createElement('option');
      appAllOpt.value = 'all';
      appAllOpt.textContent = '전체 (all)';
      appSelect.appendChild(appAllOpt);
      const uniqueApps = [...new Set(sortedEvents.map(e => e.appId).filter(Boolean))];
      for (const a of uniqueApps) {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        appSelect.appendChild(opt);
      }
      appLabel.appendChild(appSelect);
      filterBar.appendChild(appLabel);

      // (3) 접속 상태 필터
      const accessLabel = document.createElement('label');
      accessLabel.className = 'student-filter-label';
      accessLabel.textContent = '접속 상태: ';
      const accessSelect = document.createElement('select');
      accessSelect.setAttribute('aria-label', '접속 상태');
      const accessAllOpt = document.createElement('option');
      accessAllOpt.value = 'all';
      accessAllOpt.textContent = '전체 (all)';
      accessSelect.appendChild(accessAllOpt);
      const uniqueAccessStates = [...new Set(sortedEvents.map(e => e.state?.access).filter(Boolean))];
      for (const acc of uniqueAccessStates) {
        const opt = document.createElement('option');
        opt.value = acc;
        const accText = ACCESS_STATUS_LABELS[acc] || '확인 불가';
        opt.textContent = `${accText} (${acc})`;
        accessSelect.appendChild(opt);
      }
      accessLabel.appendChild(accessSelect);
      filterBar.appendChild(accessLabel);

      container.appendChild(filterBar);

      // 건수 표시
      const countP = document.createElement('p');
      countP.className = 'student-events-count';
      container.appendChild(countP);

      // 6. 목록 영역 및 상세 영역 컨테이너
      const listUl = document.createElement('ul');
      listUl.className = 'student-events-list';
      container.appendChild(listUl);

      const detailDiv = document.createElement('div');
      detailDiv.className = 'student-event-detail-container';
      container.appendChild(detailDiv);

      // 상세 영역 렌더링 함수
      function renderDetailSection() {
        detailDiv.replaceChildren();
        if (!selectedEventId) {
          detailDiv.removeAttribute('data-student-event-detail');
          return;
        }

        const ev = sortedEvents.find(e => e.id === selectedEventId);
        if (!ev) {
          detailDiv.removeAttribute('data-student-event-detail');
          return;
        }

        detailDiv.setAttribute('data-student-event-detail', ev.id);

        const detailHeader = document.createElement('h3');
        detailHeader.textContent = `기록 상세: ${ev.id}`;
        detailDiv.appendChild(detailHeader);

        // 사건 ID 및 앱 ID
        const idAppP = document.createElement('p');
        const appText = ev.appId || '앱을 확인할 수 없음';
        idAppP.textContent = `사건 ID: ${ev.id} · 업무 앱: ${appText}`;
        detailDiv.appendChild(idAppP);

        // state (access, session, device)
        const stateWrap = document.createElement('div');
        stateWrap.className = 'student-detail-state';
        const stateTitle = document.createElement('strong');
        stateTitle.textContent = '상태 정보:';
        stateWrap.appendChild(stateTitle);

        const accRaw = ev.state?.access || 'unknown';
        const accText = ACCESS_STATUS_LABELS[accRaw] || '확인 불가';
        const sessRaw = ev.state?.session || 'unknown';
        const sessText = SESSION_STATUS_LABELS[sessRaw] || '확인 불가';
        const devRaw = ev.state?.device || 'unknown';
        const devText = DEVICE_STATUS_LABELS[devRaw] || '확인 불가';

        const stateUl = document.createElement('ul');
        const liAcc = document.createElement('li');
        liAcc.textContent = `접속 상태: ${accText} (${accRaw})`;
        stateUl.appendChild(liAcc);

        const liSess = document.createElement('li');
        liSess.textContent = `세션 상태: ${sessText} (${sessRaw})`;
        stateUl.appendChild(liSess);

        const liDev = document.createElement('li');
        liDev.textContent = `기기 상태: ${devText} (${devRaw})`;
        stateUl.appendChild(liDev);

        stateWrap.appendChild(stateUl);
        detailDiv.appendChild(stateWrap);

        // 근거 (evidence)
        const evidenceWrap = document.createElement('div');
        evidenceWrap.className = 'student-detail-evidence';
        const evTitle = document.createElement('strong');
        evTitle.textContent = '근거 (Evidence):';
        evidenceWrap.appendChild(evTitle);
        const evidenceList = Array.isArray(ev.evidence) ? ev.evidence : [];
        if (evidenceList.length === 0) {
          const noEvP = document.createElement('p');
          noEvP.textContent = '등록된 근거가 없습니다.';
          evidenceWrap.appendChild(noEvP);
        } else {
          const evUl = document.createElement('ul');
          for (const item of evidenceList) {
            const li = document.createElement('li');
            li.textContent = `[${item.id || '근거'}] ${item.text || ''}`;
            evUl.appendChild(li);
          }
          evidenceWrap.appendChild(evUl);
        }
        detailDiv.appendChild(evidenceWrap);

        // 규칙 (rules)
        const rulesWrap = document.createElement('div');
        rulesWrap.className = 'student-detail-rules';
        const rulesTitle = document.createElement('strong');
        rulesTitle.textContent = '적용 규칙 (Rules):';
        rulesWrap.appendChild(rulesTitle);
        const rulesList = Array.isArray(ev.rules) ? ev.rules : [];
        if (rulesList.length === 0) {
          const noRulesP = document.createElement('p');
          noRulesP.textContent = '등록된 규칙이 없습니다.';
          rulesWrap.appendChild(noRulesP);
        } else {
          const rUl = document.createElement('ul');
          for (const r of rulesList) {
            const li = document.createElement('li');
            li.textContent = `[${r.id || '규칙'}] ${r.text || ''}`;
            rUl.appendChild(li);
          }
          rulesWrap.appendChild(rUl);
        }
        detailDiv.appendChild(rulesWrap);
      }

      // 목록 갱신 함수
      function updateList() {
        const filtered = sortedEvents.filter(ev => {
          if (currentKindFilter !== 'all' && ev.kind !== currentKindFilter) return false;
          if (currentAppFilter !== 'all' && (ev.appId || '') !== currentAppFilter) return false;
          if (currentAccessFilter !== 'all' && (ev.state?.access || 'unknown') !== currentAccessFilter) return false;
          return true;
        });

        countP.textContent = `조회 건수: ${filtered.length}건 (전체 ${sortedEvents.length}건)`;
        listUl.replaceChildren();

        if (filtered.length === 0) {
          const emptyLi = document.createElement('li');
          emptyLi.className = 'student-events-empty';
          emptyLi.textContent = '조건에 맞는 기록이 없습니다.';
          listUl.appendChild(emptyLi);
          return;
        }

        for (const ev of filtered) {
          const li = document.createElement('li');
          li.className = 'student-event-item';
          li.setAttribute('data-student-event-id', ev.id);

          // 종류 한국어 변환
          const kindText = EVENT_KIND_LABELS[ev.kind] || ev.kind;
          const appText = ev.appId || '앱을 확인할 수 없음';

          const textSpan = document.createElement('span');
          textSpan.className = 'student-event-text';
          textSpan.textContent = `[${ev.id}] ${ev.at || ''} · ${kindText} (${ev.kind}) · 앱: ${appText} · 요약: ${ev.summary || '요약 없음'}`;
          li.appendChild(textSpan);

          // 상세 보기 버튼
          const detailBtn = document.createElement('button');
          detailBtn.type = 'button';
          detailBtn.className = 'student-detail-btn btn';
          detailBtn.textContent = `${ev.id} 상세`;
          detailBtn.setAttribute('aria-label', `${ev.id} 상세`);
          detailBtn.onclick = () => {
            selectedEventId = (selectedEventId === ev.id) ? null : ev.id;
            renderDetailSection();
          };
          li.appendChild(detailBtn);

          listUl.appendChild(li);
        }
      }

      // 필터 이벤트 바인딩
      kindSelect.onchange = (e) => {
        currentKindFilter = e.target.value;
        updateList();
      };
      appSelect.onchange = (e) => {
        currentAppFilter = e.target.value;
        updateList();
      };
      accessSelect.onchange = (e) => {
        currentAccessFilter = e.target.value;
        updateList();
      };

      // 최초 렌더링
      updateList();
      renderDetailSection();

      return container;
    },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
