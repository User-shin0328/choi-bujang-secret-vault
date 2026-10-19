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
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
