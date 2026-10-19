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
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
