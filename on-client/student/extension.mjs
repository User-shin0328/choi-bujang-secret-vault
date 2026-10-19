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

function getAiErrorGuidance(code, message) {
  const c = String(code || '').toUpperCase();
  const m = String(message || '').toLowerCase();

  if (c.includes('CANCEL') || m.includes('취소')) {
    return '점검이 취소되었습니다. 이전 결과는 현재 결과가 아닙니다.';
  }
  if (c.includes('PROVISION') || c.includes('PENDING') || m.includes('권한 준비') || m.includes('확인 불가')) {
    return '권한 준비 중이거나 확인할 수 없습니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.';
  }
  if (c.includes('AUTH') || c.includes('FORBIDDEN') || c.includes('DENIED') || m.includes('인증') || m.includes('접근 제한')) {
    return '인증 실패 또는 접근 제한입니다. 계정 연결을 다시 확인하고 담당자에게 문의하세요.';
  }
  if ((c.includes('QUOTA') || c.includes('USAGE') || c.includes('LIMIT')) && !c.includes('RATE') || m.includes('사용량') || m.includes('한도')) {
    return '반 사용량 또는 이용 한도가 초과되었습니다. 담당자에게 확인을 요청하세요.';
  }
  if (c.includes('HOUR') || c.includes('SCHEDULE') || m.includes('이용 시간')) {
    return 'AI 서비스 이용 가능 시간이 아닙니다. 이용 시간을 확인하세요.';
  }
  if (c.includes('RATE') || c.includes('TIMEOUT') || c.includes('NETWORK') || m.includes('시간 초과') || m.includes('네트워크') || m.includes('요청 제한')) {
    return '요청 제한, 시간 초과 또는 네트워크 오류입니다. 잠시 뒤 직접 다시 점검하세요.';
  }
  if (c.includes('MODEL') || m.includes('모델 없음') || m.includes('사용할 수 있는 모델')) {
    return '사용할 수 있는 AI 모델이 없습니다. 담당자에게 모델 허용 설정을 확인 요청하세요.';
  }
  return '담당자에게 계정 연결과 앱 권한 확인을 요청하세요.';
}

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

        // 조치 (supportedActions) 미지원 안내 (16단계)
        const actionsList = Array.isArray(ev.supportedActions) ? ev.supportedActions : [];
        if (actionsList.length > 0) {
          const actionsWrap = document.createElement('div');
          actionsWrap.className = 'student-detail-actions';
          const actionsNotice = document.createElement('p');
          actionsNotice.className = 'status-note';
          actionsNotice.textContent = '조치 실행 연결은 준비 중입니다. 아직 지원하지 않는 조치입니다.';
          actionsWrap.appendChild(actionsNotice);

          for (const action of actionsList) {
            const actBtn = document.createElement('button');
            actBtn.type = 'button';
            actBtn.disabled = true;
            actBtn.className = 'btn btn-disabled';
            actBtn.textContent = `${action} 미지원`;
            actBtn.setAttribute('aria-label', `${action} 미지원`);
            actionsWrap.appendChild(actBtn);
          }
          detailDiv.appendChild(actionsWrap);
        }
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
    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      const container = document.createElement('div');
      container.className = 'student-status-view';
      container.setAttribute('data-student-section', 'status');

      // 1. 모드 안내 (loading, error, ok 모든 상태에서 mode 표시)
      const currentMode = mode || 'unknown';
      const modeText = MODE_LABELS[currentMode] || '확인 불가';
      const modeEl = document.createElement('div');
      modeEl.className = 'student-mode-badge';
      modeEl.textContent = `모드: ${modeText}`;
      container.appendChild(modeEl);

      // 시간 초과 판별 헬퍼
      const isTimeout = (err) => {
        if (!err) return false;
        const text = `${err.code || ''} ${err.message || ''}`.toLowerCase();
        return text.includes('timeout') || text.includes('초과') || text.includes('timedout');
      };

      // 2. 알림 (notifications) 영역
      const notifSection = document.createElement('section');
      notifSection.className = 'student-status-card';
      const notifTitle = document.createElement('h3');
      notifTitle.textContent = '알림 상태';
      notifSection.appendChild(notifTitle);

      const notifList = Array.isArray(notifications) ? notifications : [];
      if (notifList.length === 0) {
        const noNotifP = document.createElement('p');
        noNotifP.className = 'status-empty';
        noNotifP.textContent = '주의할 알림이 없습니다.';
        notifSection.appendChild(noNotifP);
      } else {
        const notifUl = document.createElement('ul');
        notifUl.className = 'plain-list';
        for (const item of notifList) {
          const li = document.createElement('li');
          li.textContent = `[자료: ${item.resource || '미지정'}] 코드: ${item.code || '알림'} · 내용: ${item.message || ''}`;
          notifUl.appendChild(li);
        }
        notifSection.appendChild(notifUl);
      }
      container.appendChild(notifSection);

      // 3. 기기 상태 (devices) 영역
      const devSection = document.createElement('section');
      devSection.className = 'student-status-card';
      const devTitle = document.createElement('h3');
      devTitle.textContent = '기기 점검 상태';
      devSection.appendChild(devTitle);

      if (!devices || devices.status === 'loading') {
        const p = document.createElement('p');
        p.className = 'status-loading';
        p.textContent = '기기 목록을 불러오는 중…';
        devSection.appendChild(p);
      } else if (devices.status === 'error') {
        const errP = document.createElement('p');
        errP.className = 'status-alert';
        const timeoutNotice = isTimeout(devices.error) ? ' (요청 시간 초과)' : '';
        errP.textContent = `기기 목록을 불러오지 못했습니다: ${devices.error?.message || '확인 불가'}${timeoutNotice}`;
        devSection.appendChild(errP);

        const retryP = document.createElement('p');
        retryP.className = 'status-note';
        retryP.textContent = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. (자동으로 다시 요청하지 않습니다)';
        devSection.appendChild(retryP);
      } else {
        const devData = Array.isArray(devices.data) ? devices.data : [];
        if (devData.length === 0) {
          const emptyP = document.createElement('p');
          emptyP.className = 'status-empty';
          emptyP.textContent = '등록된 기기가 없음';
          devSection.appendChild(emptyP);
        } else {
          const ul = document.createElement('ul');
          ul.className = 'plain-list';
          for (const d of devData) {
            const li = document.createElement('li');
            const dStatusRaw = d.status || 'unknown';
            const dStatusText = DEVICE_STATUS_LABELS[dStatusRaw] || '확인 불가';
            li.textContent = `기기: ${d.label || d.id || '기기'} (${d.id || ''}) · 상태: ${dStatusText} (${dStatusRaw})`;
            if (dStatusRaw === 'noncompliant') li.className = 'status-warning';
            ul.appendChild(li);
          }
          devSection.appendChild(ul);
        }
      }
      container.appendChild(devSection);

      // 4. 세션 상태 (sessions) 영역
      const sessSection = document.createElement('section');
      sessSection.className = 'student-status-card';
      const sessTitle = document.createElement('h3');
      sessTitle.textContent = '세션 점검 상태';
      sessSection.appendChild(sessTitle);

      const sessScopeNotice = document.createElement('p');
      sessScopeNotice.className = 'status-note';
      sessScopeNotice.textContent = '세션은 지금 검증된 연결 하나만 조회됩니다. (지난 세션 목록이 아님)';
      sessSection.appendChild(sessScopeNotice);

      if (!sessions || sessions.status === 'loading') {
        const p = document.createElement('p');
        p.className = 'status-loading';
        p.textContent = '세션 정보를 불러오는 중…';
        sessSection.appendChild(p);
      } else if (sessions.status === 'error') {
        const errP = document.createElement('p');
        errP.className = 'status-alert';
        const timeoutNotice = isTimeout(sessions.error) ? ' (요청 시간 초과)' : '';
        errP.textContent = `세션 정보를 불러오지 못했습니다: ${sessions.error?.message || '확인 불가'}${timeoutNotice}`;
        sessSection.appendChild(errP);

        const retryP = document.createElement('p');
        retryP.className = 'status-note';
        retryP.textContent = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. (자동으로 다시 요청하지 않습니다)';
        sessSection.appendChild(retryP);
      } else {
        const sessData = Array.isArray(sessions.data) ? sessions.data : [];
        if (sessData.length === 0) {
          const emptyP = document.createElement('p');
          emptyP.className = 'status-empty';
          emptyP.textContent = '현재 연결 없음';
          sessSection.appendChild(emptyP);
        } else {
          const ul = document.createElement('ul');
          ul.className = 'plain-list';
          for (const s of sessData) {
            const li = document.createElement('li');
            const sStatusRaw = s.status || 'unknown';
            const sStatusText = SESSION_STATUS_LABELS[sStatusRaw] || '확인 불가';
            li.textContent = `세션: ${s.id || '세션'} · 상태: ${sStatusText} (${sStatusRaw})`;
            if (sStatusRaw === 'expired' || sStatusRaw === 'revoked') li.className = 'status-alert';
            ul.appendChild(li);
          }
          sessSection.appendChild(ul);
        }
      }
      container.appendChild(sessSection);

      // 5. 진단 정보 (diagnostics) 영역
      const diagSection = document.createElement('section');
      diagSection.className = 'student-status-card';
      const diagTitle = document.createElement('h3');
      diagTitle.textContent = '도움정보 (진단 정보)';
      diagSection.appendChild(diagTitle);

      if (!diagnostics || diagnostics.status === 'idle') {
        const p = document.createElement('p');
        p.className = 'status-empty';
        p.textContent = '도움정보가 아직 조회되지 않았습니다. 제공 화면의 「도움정보 불러오기」를 누르세요.';
        diagSection.appendChild(p);
      } else if (diagnostics.status === 'loading') {
        const p = document.createElement('p');
        p.className = 'status-loading';
        p.textContent = '도움정보를 불러오는 중…';
        diagSection.appendChild(p);
      } else if (diagnostics.status === 'error') {
        const errP = document.createElement('p');
        errP.className = 'status-alert';
        errP.textContent = `도움정보를 불러오지 못했습니다: ${diagnostics.error?.message || '확인 불가'}`;
        diagSection.appendChild(errP);

        const retryP = document.createElement('p');
        retryP.className = 'status-note';
        retryP.textContent = '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.';
        diagSection.appendChild(retryP);
      } else {
        const diagData = diagnostics.data || {};
        const safeDiagnostics = {
          requestId: diagData.requestId || '확인 불가',
          component: diagData.component || 'on-client',
          version: diagData.version || '확인 불가',
          checkedAt: diagData.checkedAt || '확인 불가',
          engineMode: diagData.engine?.mode || 'unknown',
          engineCode: diagData.engine?.code || 'unknown',
        };

        const ul = document.createElement('ul');
        ul.className = 'plain-list';

        const liReq = document.createElement('li');
        liReq.textContent = `요청 ID (requestId): ${safeDiagnostics.requestId}`;
        ul.appendChild(liReq);

        const liComp = document.createElement('li');
        liComp.textContent = `컴포넌트 (component): ${safeDiagnostics.component}`;
        ul.appendChild(liComp);

        const liVer = document.createElement('li');
        liVer.textContent = `버전 (version): ${safeDiagnostics.version}`;
        ul.appendChild(liVer);

        const liTime = document.createElement('li');
        liTime.textContent = `확인 시각 (checkedAt): ${safeDiagnostics.checkedAt}`;
        ul.appendChild(liTime);

        const liMode = document.createElement('li');
        liMode.textContent = `엔진 모드 (engine.mode): ${safeDiagnostics.engineMode}`;
        ul.appendChild(liMode);

        const liCode = document.createElement('li');
        liCode.textContent = `엔진 코드 (engine.code): ${safeDiagnostics.engineCode}`;
        ul.appendChild(liCode);

        diagSection.appendChild(ul);

        // 도움정보 복사 버튼 (정확한 이름 「도움정보 복사」)
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn';
        copyBtn.textContent = '도움정보 복사';
        copyBtn.setAttribute('aria-label', '도움정보 복사');

        const copyNotice = document.createElement('p');
        copyNotice.className = 'status-note';
        copyNotice.textContent = '이 정보는 도움 요청에 쓰도록 비밀(API 키·토큰) 없는 안전한 값만 복사됩니다.';

        copyBtn.onclick = async () => {
          const textToCopy = JSON.stringify(safeDiagnostics, null, 2);
          try {
            if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
              await navigator.clipboard.writeText(textToCopy);
            }
            copyNotice.textContent = '도움정보가 클립보드에 안전하게 복사되었습니다.';
          } catch {
            copyNotice.textContent = '클립보드 복사에 실패했습니다.';
          }
        };

        diagSection.appendChild(copyBtn);
        diagSection.appendChild(copyNotice);
      }
      container.appendChild(diagSection);

      return container;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted } = {}) {
      const container = document.createElement('div');
      container.className = 'student-ai-connection-view';
      container.setAttribute('data-student-section', 'ai-connection');

      // 1. 모드 안내 (모든 상태에서 mode 표시)
      const currentMode = mode || 'unknown';
      const modeText = MODE_LABELS[currentMode] || '확인 불가';
      const modeEl = document.createElement('div');
      modeEl.className = 'student-mode-badge';
      modeEl.textContent = `모드: ${modeText}`;
      container.appendChild(modeEl);

      // 2. idle: 아직 점검 전 상태
      if (!status || status === 'idle') {
        const idleP = document.createElement('p');
        idleP.className = 'status-empty';
        idleP.textContent = 'AI 연결 점검 전입니다. 설정값 존재는 이용 권한 확인이 아닙니다.';
        container.appendChild(idleP);
        return container;
      }

      // 3. loading: 점검 중 상태
      if (status === 'loading') {
        const loadP = document.createElement('p');
        loadP.className = 'status-loading';
        loadP.textContent = 'AI 연결 점검 중… 현재 로그인으로 모델 응답을 확인하고 있습니다.';
        container.appendChild(loadP);
        return container;
      }

      // 4. error: 실패 상태
      if (status === 'error') {
        const errWrap = document.createElement('div');
        errWrap.className = 'status-alert';
        errWrap.setAttribute('data-student-status', 'error');

        const safeCode = error && error.code ? error.code : 'UNVERIFIED';
        const safeMsg = error && error.message ? error.message : '확인 불가';

        const errP = document.createElement('p');
        errP.textContent = `연결 점검 실패: [${safeCode}] ${safeMsg}`;
        errWrap.appendChild(errP);

        // 코드별 원인 상세 안내
        const causeNotice = document.createElement('p');
        causeNotice.className = 'status-cause';
        causeNotice.textContent = getAiErrorGuidance(safeCode, safeMsg);
        errWrap.appendChild(causeNotice);

        // 수동 재점검 안내
        const retryNotice = document.createElement('p');
        retryNotice.className = 'status-note';
        retryNotice.textContent = '다시 점검은 제공 화면의 점검 버튼을 직접 누르세요. (자동으로 다시 점검하지 않습니다)';
        errWrap.appendChild(retryNotice);

        container.appendChild(errWrap);
        return container;
      }

      // 5. ok: 점검 완료 상태
      const auth = data?.audienceAuthorization;
      const authText = auth === 'test'
        ? '시험 연결 점검(test)'
        : (auth === 'verified' ? '앱 권한 확인 후 점검(verified)' : `${auth || '확인 불가'}(${auth || 'unknown'})`);

      const authP = document.createElement('p');
      authP.className = 'student-ai-auth';
      authP.textContent = `권한 확인 상태: ${authText}`;
      container.appendChild(authP);

      const countP = document.createElement('p');
      countP.className = 'student-ai-models';
      countP.textContent = `응답 모델 수: ${data?.modelCount ?? 0}개`;
      container.appendChild(countP);

      const timeP = document.createElement('p');
      timeP.className = 'student-ai-time';
      timeP.textContent = `점검 시각: ${checkedAt || '확인 불가'}`;
      container.appendChild(timeP);

      // 사건 설명 미실행 명시 (중요: 모델 목록 응답을 사건 설명으로 혼동하지 않게 함)
      const notRunP = document.createElement('p');
      notRunP.className = 'status-note';
      notRunP.textContent = '사건 설명은 아직 실행하지 않았습니다. (연결 상태만 점검되었으며 실제 사건 설명은 보안 기록에서 별도로 실행됩니다)';
      container.appendChild(notRunP);

      return container;
    },
    renderExplanation({ event, explanation, checkedAt } = {}) {
      const container = document.createElement('div');
      container.className = 'student-explanation-view';
      container.setAttribute('data-student-section', 'explanation');

      const expResource = explanation || {};
      const status = expResource.status || 'idle';

      // 1. idle: 요청 전 상태
      if (status === 'idle') {
        const idleP = document.createElement('p');
        idleP.className = 'status-empty';
        idleP.textContent = '사건을 선택하고 AI 설명을 요청하세요.';
        container.appendChild(idleP);
        return container;
      }

      // 2. loading: 생성 중 상태
      if (status === 'loading') {
        const loadP = document.createElement('p');
        loadP.className = 'status-loading';
        loadP.textContent = '사건 설명을 생성하는 중…';
        container.appendChild(loadP);
        return container;
      }

      // 3. error: 실패 상태 (data-student-explanation-event 속성 제외)
      if (status === 'error') {
        const errWrap = document.createElement('div');
        errWrap.className = 'status-alert';
        errWrap.setAttribute('data-student-status', 'error');

        const safeCode = expResource.error?.code || 'ERROR';
        const safeMsg = expResource.error?.message || '확인 불가';

        const errP = document.createElement('p');
        errP.textContent = `설명 생성 실패: [${safeCode}] ${safeMsg}`;
        errWrap.appendChild(errP);

        const noticeP = document.createElement('p');
        noticeP.className = 'status-note';
        noticeP.textContent = '사건 기록은 그대로 유지됩니다. (실패는 기록을 변경하지 않습니다)';
        errWrap.appendChild(noticeP);

        container.appendChild(errWrap);
        return container;
      }

      // 4. ok: 성공 상태
      if (event && event.id) {
        container.setAttribute('data-student-explanation-event', event.id);
      }

      const eventIdP = document.createElement('p');
      eventIdP.className = 'student-explanation-event-id';
      eventIdP.textContent = `사건 ID: ${event?.id || '알 수 없음'}`;
      container.appendChild(eventIdP);

      const summaryP = document.createElement('p');
      summaryP.className = 'student-explanation-summary';
      summaryP.textContent = `설명 요약: ${expResource.data?.summary || '요약 없음'}`;
      container.appendChild(summaryP);

      if (checkedAt) {
        const timeP = document.createElement('p');
        timeP.className = 'student-explanation-time';
        timeP.textContent = `확인 시각: ${checkedAt}`;
        container.appendChild(timeP);
      }

      return container;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
