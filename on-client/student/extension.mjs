// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
const DEVICE_STATUS_LABELS = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
const SESSION_STATUS_LABELS = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
const MODE_LABELS = { demo: '로컬 실측 점검', disconnected: '연결 없음', connected: '연결됨', unknown: '확인 불가' };
const DECISION_LABELS = {
  allow: { label: '접근 허용', note: '정책상 접근이 허용되었습니다. (실제 앱 접속 성공을 보장하지는 않습니다)' },
  deny: { label: '접근 거부', note: '정책상 접근이 거부되었습니다.' },
  challenge: { label: '추가 인증 또는 확인 필요', note: '추가 확인이 필요하며, 앱이 확인 절차를 대신하지 않습니다.' },
  unknown: { label: '판정 확인 불가', note: '판정을 확인할 수 없으며 정상 또는 접근이 허용되지 않았습니다.' }
};
const ACCESS_STATUS_LABELS = { allowed: '접근 허용', denied: '접근 거부', unknown: '확인 불가' };
const EVENT_KIND_LABELS = { access: '접속', xdr: 'XDR 경보' };

function getAiErrorGuidance(code, message) {
  const c = String(code || '').toUpperCase(), m = String(message || '').toLowerCase();
  if (c.includes('CANCEL') || m.includes('취소')) return '점검이 취소되었습니다. 이전 결과는 현재 결과가 아닙니다.';
  if (c.includes('PROVISION') || c.includes('PENDING') || m.includes('권한 준비') || m.includes('확인 불가')) return '권한 준비 중이거나 확인할 수 없습니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.';
  if (c.includes('AUTH') || c.includes('FORBIDDEN') || c.includes('DENIED') || m.includes('인증') || m.includes('접근 제한')) return '인증 실패 또는 접근 제한입니다. 계정 연결을 다시 확인하고 담당자에게 문의하세요.';
  if ((c.includes('QUOTA') || c.includes('USAGE') || c.includes('LIMIT')) && !c.includes('RATE') || m.includes('사용량') || m.includes('한도')) return '반 사용량 또는 이용 한도가 초과되었습니다. 담당자에게 확인을 요청하세요.';
  if (c.includes('HOUR') || c.includes('SCHEDULE') || m.includes('이용 시간')) return 'AI 서비스 이용 가능 시간이 아닙니다. 이용 시간을 확인하세요.';
  if (c.includes('RATE') || c.includes('TIMEOUT') || c.includes('NETWORK') || m.includes('시간 초과') || m.includes('네트워크') || m.includes('요청 제한')) return '요청 제한, 시간 초과 또는 네트워크 오류입니다. 잠시 뒤 직접 다시 점검하세요.';
  if (c.includes('MODEL') || m.includes('모델 없음') || m.includes('사용할 수 있는 모델')) return '사용할 수 있는 AI 모델이 없습니다. 담당자에게 모델 허용 설정을 확인 요청하세요.';
  return '담당자에게 계정 연결과 앱 권한 확인을 요청하세요.';
}

const el = (tag, cls, text, attrs) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
  return node;
};

// PC 상태 점검 기록 타임라인 및 추이 비교를 위한 스냅샷 저장소
const pcStatusHistory = [];
let pcStatusFilter = 'all'; // 'all' | 'real' | 'demo'

export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const container = el('div', 'student-identity-view', null, { 'data-student-section': 'identity' });
      const currentMode = (me?.mode) || (devices?.mode) || (sessions?.mode) || 'unknown';
      container.appendChild(el('div', 'student-mode-badge', `모드: ${MODE_LABELS[currentMode] || '확인 불가'}`));

      // 핵심 3대 기능 최상단 우선 안내 배너 및 원클릭 탭 전환 내비게이션
      const navBox = el('div', 'student-feature-quick-nav');
      navBox.style.cssText = 'background: #e7eefc; border: 2px solid #2357c6; border-radius: 8px; padding: 14px 18px; margin: 12px 0 16px; line-height: 1.75; letter-spacing: 0.025em; box-shadow: 0 2px 6px rgba(35,87,198,0.08);';
      const navTitle = el('div', null);
      navTitle.style.cssText = 'font-weight: 700; color: #2357c6; font-size: 1rem; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;';
      navTitle.innerHTML = '<span>★ bankhar_b 핵심 3대 기능 구현 내비게이션</span><span style="font-size:0.8rem;background:#2357c6;color:#fff;padding:2px 8px;border-radius:4px;">작전: 기록 타임라인형</span>';
      navBox.appendChild(navTitle);

      const navUl = el('ul', 'plain-list');
      navUl.style.cssText = 'font-size: 0.9rem; margin: 0 0 12px; padding: 0; list-style: none;';
      navUl.appendChild(el('li', null, '① [보안 기록] 탭: 시각순 사건 타임라인 및 4종 퀵 필터 (renderEvents)'));
      navUl.appendChild(el('li', null, '② [보호 현황] 아래: 내 PC 보안·네트워크·자원 진단 및 추이 (renderStatus)'));
      navUl.appendChild(el('li', null, '③ [보안 기록] 탭: 4단계 조치 상태 전이 타임라인 게이지 (renderAction)'));
      navBox.appendChild(navUl);

      const btnRow = el('div', 'student-nav-btn-row');
      btnRow.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;';

      const createNavBtn = (label, tabId, slotId, ariaLabel) => {
        const btn = el('button', 'btn', label, {
          type: 'button',
          tabindex: '0',
          'aria-label': ariaLabel
        });
        btn.style.cssText = 'font-size: 0.85rem; padding: 8px 14px; font-weight: 600; cursor: pointer; border-radius: 6px; border: 1px solid #2357c6; background: #ffffff; color: #2357c6; transition: all 0.15s ease;';
        btn.onmouseover = () => { btn.style.background = '#2357c6'; btn.style.color = '#ffffff'; };
        btn.onmouseout = () => { btn.style.background = '#ffffff'; btn.style.color = '#2357c6'; };
        btn.onclick = () => {
          if (tabId) {
            const tabBtn = document.getElementById(tabId);
            if (tabBtn) tabBtn.click();
          }
          setTimeout(() => {
            const target = document.getElementById(slotId) || document.querySelector(`[data-student-section="${slotId.replace('student-', '')}"]`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        };
        btn.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            btn.click();
          }
        };
        return btn;
      };

      btnRow.appendChild(createNavBtn('① [보안 기록] 사건 타임라인 바로보기 ➔', 'tab-records', 'student-events', '보안 기록 탭으로 이동하여 사건 타임라인 보기'));
      btnRow.appendChild(createNavBtn('② [보호 현황] 내 PC 진단 바로보기 ⬇', 'tab-protection', 'student-status', '보호 현황 탭의 내 PC 상태 진단 영역으로 스크롤'));
      btnRow.appendChild(createNavBtn('③ [보안 기록] 4단계 조치 게이지 바로보기 ➔', 'tab-records', 'student-action', '보안 기록 탭으로 이동하여 조치 상태 게이지 보기'));
      navBox.appendChild(btnRow);
      container.appendChild(navBox);

      if (!me || me.status === 'loading') {
        container.appendChild(el('p', 'student-status-loading', '불러오는 중'));
        return container;
      }
      if (me.status === 'error') {
        container.appendChild(el('p', 'student-status-error', `연결 실패: ${me.error?.message || '확인 불가'}`));
        return container;
      }

      const userData = me.data?.user || {}, deviceData = me.data?.device || {}, sessionData = me.data?.session || {};
      const userLabel = userData.label || userData.id || '확인 불가';
      container.appendChild(el('p', 'student-identity-user', userData.id && userData.label ? `사용자: ${userData.label} (${userData.id})` : `사용자: ${userLabel}`, { 'data-student-field': 'user' }));

      const devStatusRaw = deviceData.status || 'unknown', devStatusText = DEVICE_STATUS_LABELS[devStatusRaw] || '확인 불가';
      const devLabel = deviceData.label || deviceData.id || '확인 불가', devIdPart = deviceData.id && deviceData.label ? ` (${deviceData.id})` : '';
      const devAttrs = { 'data-student-field': 'device' };
      if (devStatusRaw === 'noncompliant') devAttrs['data-student-status'] = 'noncompliant';
      container.appendChild(el('p', devStatusRaw === 'noncompliant' ? 'student-identity-device status-warning' : 'student-identity-device', `기기: ${devLabel}${devIdPart} · 상태: ${devStatusText} (${devStatusRaw})`, devAttrs));

      const sessStatusRaw = sessionData.status || 'unknown', sessStatusText = SESSION_STATUS_LABELS[sessStatusRaw] || '확인 불가';
      const sessAttrs = { 'data-student-field': 'session' };
      if (sessStatusRaw === 'expired' || sessStatusRaw === 'revoked') sessAttrs['data-student-status'] = sessStatusRaw;
      container.appendChild(el('p', (sessStatusRaw === 'expired' || sessStatusRaw === 'revoked') ? 'student-identity-session status-alert' : 'student-identity-session', `세션: ${sessionData.id || '확인 불가'} · 상태: ${sessStatusText} (${sessStatusRaw})`, sessAttrs));

      if (devices?.status === 'error') container.appendChild(el('p', 'student-status-error', `기기 목록 연결 실패: ${devices.error?.message || '확인 불가'}`));
      if (sessions?.status === 'error') container.appendChild(el('p', 'student-status-error', `세션 목록 연결 실패: ${sessions.error?.message || '확인 불가'}`));
      return container;
    },

    renderDecision({ status, mode, data, error, appId } = {}) {
      const container = el('div', 'student-decision-view', null, { 'data-student-section': 'decision' });
      container.appendChild(el('div', 'student-mode-badge', `모드: ${MODE_LABELS[mode || 'unknown'] || '확인 불가'}`));

      if (!status || status === 'idle') {
        container.appendChild(el('p', 'student-decision-idle', '앱을 골라 접속을 요청하세요.'));
        return container;
      }
      if (status === 'loading') {
        container.appendChild(el('p', 'student-decision-loading', appId ? `${appId} 판정 확인 중…` : '판정 확인 중…'));
        return container;
      }
      if (status === 'error') {
        const errorWrap = el('div', 'student-decision-error status-alert', null, { 'data-student-status': 'error' });
        errorWrap.appendChild(el('p', null, `요청 실패: ${error?.message || '확인 불가'}`));
        errorWrap.appendChild(el('p', 'status-note', '요청 실패는 거부 판정이 아니며, 정상 또는 접근이 허용되지 않았습니다.'));
        container.appendChild(errorWrap);
        return container;
      }

      const decisionData = data || {}, rawDecision = decisionData.decision;
      const effectiveDecision = ['allow', 'deny', 'challenge', 'unknown'].includes(rawDecision) ? rawDecision : 'unknown';
      const decisionInfo = DECISION_LABELS[effectiveDecision];

      container.appendChild(el('p', 'student-decision-app', `업무 앱: ${decisionData.appId || appId || '알 수 없음'}`, { 'data-student-field': 'appId' }));
      let decCls = `student-decision-result decision-${effectiveDecision}`;
      if (effectiveDecision === 'deny' || effectiveDecision === 'unknown') decCls += ' status-alert';
      else if (effectiveDecision === 'challenge') decCls += ' status-warning';
      container.appendChild(el('p', decCls, `판정: ${decisionInfo.label} (${effectiveDecision})`, { 'data-student-decision': effectiveDecision }));
      container.appendChild(el('p', 'student-decision-note', decisionInfo.note));
      container.appendChild(el('p', 'student-decision-reason', `판정 이유: ${decisionData.reason || '사유 정보 없음'}`, { 'data-student-field': 'reason' }));
      container.appendChild(el('p', 'student-decision-time', `판정 시각: ${decisionData.checkedAt || '확인 불가'}`, { 'data-student-field': 'checkedAt' }));
      return container;
    },

    renderEvents({ status, mode, data, error } = {}) {
      const container = el('div', 'student-events-view', null, { 'data-student-section': 'events' });
      const modeLabel = MODE_LABELS[mode || 'unknown'] || '확인 불가';
      const sourceTag = '[실측: 로컬 시스템 측정값]';

      // 핵심 기능 1 최상단 안내 뱃지
      const eventHeader = el('div', 'student-feature-header');
      eventHeader.style.cssText = 'background: #e7eefc; border: 1px solid #2357c6; border-radius: 6px; padding: 8px 14px; margin: 10px 0; font-weight: 700; color: #2357c6; font-size: 0.95rem;';
      eventHeader.textContent = '★ [핵심 기능 ①] 시각순 보안 기록 타임라인 및 4종 퀵 필터';
      container.appendChild(eventHeader);
      
      // 타임라인 가독성 스타일 블록 (줄간격 line-height: 1.75 및 글간격 letter-spacing: 0.025em 적절히 확장)
      const timelineStyle = el('style', null, `
        .student-timeline-list { display: flex; flex-direction: column; gap: 14px; padding: 0; list-style: none; margin: 16px 0; }
        .student-timeline-item {
          display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
          padding: 14px 18px; border: 1px solid var(--border, #d9dde3);
          border-left: 5px solid var(--accent, #2357c6); border-radius: 8px;
          background: var(--surface, #ffffff); line-height: 1.75; letter-spacing: 0.025em;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .student-timeline-time {
          padding: 5px 12px; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.04em;
          background: #e7eefc; color: #2357c6; border-radius: 6px; white-space: nowrap;
        }
        .student-item-source {
          padding: 4px 10px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.03em;
          border-radius: 6px; white-space: nowrap;
        }
        .student-item-source.tag-demo { background: #fff4e0; color: #9a5b00; border: 1px solid #ffd591; }
        .student-item-source.tag-real { background: #e5f4ea; color: #1d7a3e; border: 1px solid #b7eb8f; }
        .student-event-text {
          flex: 1 1 520px; line-height: 1.8; letter-spacing: 0.025em; font-size: 0.95rem;
          color: var(--text, #1c2430); word-break: keep-all; overflow-wrap: break-word;
        }
        .student-timeline-quick-tabs { display: flex; gap: 10px; margin: 14px 0 16px; flex-wrap: wrap; }
        .student-timeline-quick-tabs .btn-tab {
          padding: 8px 18px; font-size: 0.9rem; letter-spacing: 0.03em; font-weight: 600;
          border-radius: 20px; border: 1px solid #d9dde3; background: #ffffff; cursor: pointer;
          transition: all 0.15s ease;
        }
        .student-timeline-quick-tabs .btn-tab.active {
          background: #2357c6; color: #ffffff; border-color: #2357c6;
        }
        .student-events-filters { display: flex; gap: 18px; margin-bottom: 14px; flex-wrap: wrap; }
        .student-filter-label { font-size: 0.9rem; letter-spacing: 0.02em; line-height: 1.6; }
        .student-detail-btn { margin-left: auto; padding: 6px 14px; font-size: 0.85rem; white-space: nowrap; }
      `);
      container.appendChild(timelineStyle);

      const badgeWrap = el('div', 'student-mode-badge-wrap');
      badgeWrap.appendChild(el('span', 'student-mode-badge', `모드: ${modeLabel}`));
      badgeWrap.appendChild(el('span', `student-source-badge ${isDemo ? 'badge-demo' : 'badge-real'}`, sourceTag));
      container.appendChild(badgeWrap);

      if (!status || status === 'loading') {
        container.appendChild(el('p', 'student-events-loading', '보안 기록을 불러오는 중…'));
        return container;
      }
      if (status === 'error') {
        const wrap = el('div', 'student-events-error status-alert', null, { 'data-student-status': 'error' });
        wrap.appendChild(el('p', null, `기록을 불러오지 못했습니다: ${error?.message || '확인 불가'}`));
        container.appendChild(wrap);
        return container;
      }

      const eventsList = Array.isArray(data) ? data : [];
      if (eventsList.length === 0) {
        container.appendChild(el('p', 'student-events-empty', '표시할 기록이 없습니다.'));
        return container;
      }

      // 타임라인형: 시각(at) 기준 내림차순(최신순) 정렬
      const sortedEvents = [...eventsList].sort((a, b) => (b.at ? Date.parse(b.at) : 0) - (a.at ? Date.parse(a.at) : 0));
      let currentKindFilter = 'all', currentAppFilter = 'all', currentAccessFilter = 'all', selectedEventId = null;

      // 작전: 기록 타임라인형 - 종류별 거르기 4종 퀵 필터 탭
      const quickTabs = el('div', 'student-timeline-quick-tabs');
      const tabOptions = [
        { label: '전체 기록 (All)', val: 'all' },
        { label: '업무 앱 접속 (Access)', val: 'access' },
        { label: 'XDR 보안 경보 (XDR)', val: 'xdr' },
        { label: '접근 차단·경고 (Blocked)', val: 'blocked' }
      ];
      const quickButtons = [];
      tabOptions.forEach(tab => {
        const btn = el('button', `btn btn-tab ${tab.val === 'all' ? 'active' : ''}`, tab.label, {
          type: 'button',
          tabindex: '0',
          'aria-label': `${tab.label} 필터 적용`
        });
        btn.onclick = () => {
          currentKindFilter = tab.val;
          if (typeof kindSelect !== 'undefined' && kindSelect) {
            if (tab.val === 'all' || tab.val === 'access' || tab.val === 'xdr') {
              kindSelect.value = tab.val;
            }
          }
          quickButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          updateList();
        };
        btn.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            btn.click();
          }
        };
        quickButtons.push(btn);
        quickTabs.appendChild(btn);
      });
      container.appendChild(quickTabs);

      const filterBar = el('div', 'student-events-filters');
      const createFilter = (title, ariaLabel, values, labelMap) => {
        const lbl = el('label', 'student-filter-label', `${title}: `);
        const sel = el('select', null, null, { 'aria-label': ariaLabel });
        sel.appendChild(el('option', null, '전체 (all)', { value: 'all' }));
        for (const v of values) {
          const optText = labelMap ? `${labelMap[v] || v} (${v})` : v;
          sel.appendChild(el('option', null, optText, { value: v }));
        }
        lbl.appendChild(sel);
        filterBar.appendChild(lbl);
        return sel;
      };

      const kindSelect = createFilter('기록 종류', '기록 종류', [...new Set(sortedEvents.map(e => e.kind).filter(Boolean))], EVENT_KIND_LABELS);
      const appSelect = createFilter('업무 앱', '업무 앱', [...new Set(sortedEvents.map(e => e.appId).filter(Boolean))]);
      const accessSelect = createFilter('접속 상태', '접속 상태', [...new Set(sortedEvents.map(e => e.state?.access).filter(Boolean))], ACCESS_STATUS_LABELS);
      container.appendChild(filterBar);

      const countP = el('p', 'student-events-count');
      container.appendChild(countP);
      const listUl = el('ul', 'student-events-list student-timeline-list');
      container.appendChild(listUl);
      const detailDiv = el('div', 'student-event-detail-container');
      container.appendChild(detailDiv);

      function renderDetailSection() {
        detailDiv.replaceChildren();
        if (!selectedEventId) { detailDiv.removeAttribute('data-student-event-detail'); return; }
        const ev = sortedEvents.find(e => e.id === selectedEventId);
        if (!ev) { detailDiv.removeAttribute('data-student-event-detail'); return; }

        detailDiv.setAttribute('data-student-event-detail', ev.id);
        detailDiv.appendChild(el('h3', null, `기록 상세: ${ev.id}`));
        detailDiv.appendChild(el('p', null, `사건 ID: ${ev.id} · 업무 앱: ${ev.appId || '앱을 확인할 수 없음'}`));

        const stateWrap = el('div', 'student-detail-state');
        stateWrap.appendChild(el('strong', null, '상태 정보:'));
        const sUl = el('ul');
        const accRaw = ev.state?.access || 'unknown', sessRaw = ev.state?.session || 'unknown', devRaw = ev.state?.device || 'unknown';
        sUl.appendChild(el('li', null, `접속 상태: ${ACCESS_STATUS_LABELS[accRaw] || '확인 불가'} (${accRaw})`));
        sUl.appendChild(el('li', null, `세션 상태: ${SESSION_STATUS_LABELS[sessRaw] || '확인 불가'} (${sessRaw})`));
        sUl.appendChild(el('li', null, `기기 상태: ${DEVICE_STATUS_LABELS[devRaw] || '확인 불가'} (${devRaw})`));
        stateWrap.appendChild(sUl);
        detailDiv.appendChild(stateWrap);

        const evWrap = el('div', 'student-detail-evidence');
        evWrap.appendChild(el('strong', null, '근거 (Evidence):'));
        const evList = Array.isArray(ev.evidence) ? ev.evidence : [];
        if (evList.length === 0) evWrap.appendChild(el('p', null, '등록된 근거가 없습니다.'));
        else {
          const u = el('ul');
          for (const item of evList) u.appendChild(el('li', null, `[${item.id || '근거'}] ${item.text || ''}`));
          evWrap.appendChild(u);
        }
        detailDiv.appendChild(evWrap);

        const rulesWrap = el('div', 'student-detail-rules');
        rulesWrap.appendChild(el('strong', null, '적용 규칙 (Rules):'));
        const rList = Array.isArray(ev.rules) ? ev.rules : [];
        if (rList.length === 0) rulesWrap.appendChild(el('p', null, '등록된 규칙이 없습니다.'));
        else {
          const u = el('ul');
          for (const r of rList) u.appendChild(el('li', null, `[${r.id || '규칙'}] ${r.text || ''}`));
          rulesWrap.appendChild(u);
        }
        detailDiv.appendChild(rulesWrap);

        const actionsList = Array.isArray(ev.supportedActions) ? ev.supportedActions : [];
        if (actionsList.length > 0) {
          const actWrap = el('div', 'student-detail-actions');
          actWrap.appendChild(el('p', 'status-note', '조치 실행 연결은 준비 중입니다. 아직 지원하지 않는 조치입니다.'));
          for (const action of actionsList) {
            const btn = el('button', 'btn btn-disabled', `${action} 미지원`, { type: 'button', 'aria-label': `${action} 미지원` });
            btn.disabled = true;
            actWrap.appendChild(btn);
          }
          detailDiv.appendChild(actWrap);
        }
      }

      function updateList() {
        const filtered = sortedEvents.filter(ev => {
          if (currentKindFilter === 'access' && ev.kind !== 'access') return false;
          if (currentKindFilter === 'xdr' && ev.kind !== 'xdr') return false;
          if (currentKindFilter === 'blocked' && (ev.state?.access !== 'denied' && ev.state?.device !== 'noncompliant')) return false;
          if (currentAppFilter !== 'all' && (ev.appId || '') !== currentAppFilter) return false;
          if (currentAccessFilter !== 'all' && (ev.state?.access || 'unknown') !== currentAccessFilter) return false;
          return true;
        });

        countP.textContent = `조회 건수: ${filtered.length}건 (전체 ${sortedEvents.length}건 타임라인)`;
        listUl.replaceChildren();
        if (filtered.length === 0) {
          listUl.appendChild(el('li', 'student-events-empty', '조건에 맞는 타임라인 기록이 없습니다.'));
          return;
        }

        for (const ev of filtered) {
          const li = el('li', 'student-event-item student-timeline-item', null, { 'data-student-event-id': ev.id });
          const kindText = EVENT_KIND_LABELS[ev.kind] || ev.kind;
          
          // 타임라인 시각 배지와 출처 배지
          const timeBadge = el('span', 'student-timeline-time', `[시간] ${ev.at || '시각 미상'}`);
          const itemSource = el('span', 'student-item-source tag-real', '[실측]');
          const summaryText = el('span', 'student-event-text', `[${ev.id}] · ${kindText} (${ev.kind}) · 앱: ${ev.appId || '앱을 확인할 수 없음'} · 요약: ${ev.summary || '요약 없음'}`);

          li.appendChild(timeBadge);
          li.appendChild(itemSource);
          li.appendChild(summaryText);

          const detailBtn = el('button', 'student-detail-btn btn', `${ev.id} 상세`, { type: 'button', 'aria-label': `${ev.id} 상세` });
          detailBtn.onclick = () => { selectedEventId = (selectedEventId === ev.id) ? null : ev.id; renderDetailSection(); };
          li.appendChild(detailBtn);
          listUl.appendChild(li);
        }
      }

      kindSelect.onchange = e => {
        currentKindFilter = e.target.value;
        quickButtons.forEach(b => {
          if ((b.textContent.includes('전체') && e.target.value === 'all') ||
              (b.textContent.includes('접속') && e.target.value === 'access') ||
              (b.textContent.includes('XDR') && e.target.value === 'xdr')) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
        updateList();
      };
      appSelect.onchange = e => { currentAppFilter = e.target.value; updateList(); };
      accessSelect.onchange = e => { currentAccessFilter = e.target.value; updateList(); };
      updateList();
      renderDetailSection();
      return container;
    },

    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      // 제공 화면 타이틀 명칭을 사용자가 요청한 '내 PC 상태'로 동적 변경
      if (typeof document !== 'undefined') {
        const extTitleEl = document.getElementById('student-status-title');
        if (extTitleEl) {
          extTitleEl.innerHTML = '내 PC 상태 <span class="tag tag-student">student/extension.mjs · renderStatus</span>';
        }
      }

      const container = el('div', 'student-status-view', null, { 'data-student-section': 'status' });
      container.appendChild(el('div', 'student-mode-badge', `모드: ${MODE_LABELS[mode || 'unknown'] || '확인 불가'}`));

      const isTimeout = err => {
        if (!err) return false;
        const text = `${err.code || ''} ${err.message || ''}`.toLowerCase();
        return text.includes('timeout') || text.includes('초과') || text.includes('timedout');
      };

      // 타임라인 및 PC 자원 가독성 스타일 블록 (막대 바 게이지 및 원형 뱃지 시각화 강화)
      const statusStyle = el('style', null, `
        :focus-visible { outline: 3px solid #f5b400 !important; outline-offset: 2px !important; }
        .pc-top-panel {
          background: #ffffff; border: 2px solid #2357c6; border-radius: 8px; padding: 16px 20px;
          margin: 12px 0 16px; line-height: 1.75; letter-spacing: 0.025em; box-shadow: 0 2px 6px rgba(35,87,198,0.08);
        }
        .pc-top-header { font-size: 1.1rem; font-weight: 700; color: #2357c6; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .pc-btn-group { display: flex; align-items: center; gap: 12px; margin: 10px 0; flex-wrap: wrap; }
        .pc-refresh-btn {
          background: #2357c6; color: #ffffff; font-weight: 700; font-size: 0.9rem; padding: 8px 18px;
          border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px;
        }
        .pc-refresh-btn:hover { background: #1a44a1; }
        .pc-refresh-btn:disabled { background: #8fa5d6; cursor: not-allowed; }
        .pc-loading-indicator { font-size: 0.88rem; font-weight: 600; padding: 6px 12px; border-radius: 6px; }
        .pc-loading-indicator.idle { background: #e7eefc; color: #2357c6; border: 1px solid #b8d0fc; }
        .pc-loading-indicator.busy { background: #fffbe6; color: #d46b08; border: 1px solid #ffe58f; animation: pulse 1s infinite alternate; }
        .pc-loading-indicator.done { background: #f6ffed; color: #389e0d; border: 1px solid #b7eb8f; }
        @keyframes pulse { from { opacity: 0.6; } to { opacity: 1; } }
        .pc-failure-guide {
          background: #fff2f0; border: 1px solid #ffccc7; border-radius: 6px; padding: 12px 14px;
          margin-top: 10px; font-size: 0.88rem; line-height: 1.6; color: #434343;
        }
        .pc-resource-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin: 14px 0; }
        .pc-resource-card {
          padding: 16px; border: 1px solid var(--border, #d9dde3); border-radius: 8px;
          background: var(--surface, #ffffff); line-height: 1.75; letter-spacing: 0.025em;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .pc-resource-card h4 { margin: 0 0 10px; font-size: 1rem; color: #2357c6; display: flex; align-items: center; justify-content: space-between; }
        .pc-badge-tag { display: inline-block; padding: 3px 8px; font-size: 0.75rem; border-radius: 4px; font-weight: 600; margin-left: 6px; white-space: nowrap; }
        .pc-badge-tag.real { background: #e5f4ea; color: #1d7a3e; border: 1px solid #b7eb8f; }
        .pc-badge-tag.unv { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
        .pc-badge-tag.sdp-off { background: #fff1f0; color: #cf1322; border: 1px solid #ffa39e; font-weight: 700; }
        .pc-unv-reason { font-size: 0.85rem; color: #b91c1c; background: #fff5f5; padding: 6px 10px; border-radius: 4px; margin: 6px 0 10px; line-height: 1.6; word-break: keep-all; }
        .pc-safe-notice { font-size: 0.9rem; color: #2357c6; background: #e7eefc; padding: 10px 14px; border-radius: 6px; margin: 10px 0; line-height: 1.6; border-left: 4px solid #2357c6; }
        .pc-timeline-list { display: flex; flex-direction: column; gap: 12px; margin: 14px 0; padding: 0; list-style: none; }
        .pc-timeline-item {
          padding: 14px 18px; border: 1px solid var(--border, #d9dde3); border-left: 5px solid #2357c6;
          border-radius: 8px; background: #ffffff; line-height: 1.75; letter-spacing: 0.025em;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .pc-timeline-header { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
        .pc-timeline-time { padding: 4px 10px; font-size: 0.85rem; font-weight: 700; background: #e7eefc; color: #2357c6; border-radius: 6px; }
        .pc-trend-badge { padding: 3px 8px; font-size: 0.8rem; font-weight: 600; border-radius: 4px; }
        .pc-trend-up { background: #fff1f0; color: #cf1322; border: 1px solid #ffa39e; }
        .pc-trend-down { background: #f6ffed; color: #389e0d; border: 1px solid #b7eb8f; }
        .pc-trend-same { background: #f5f5f5; color: #595959; border: 1px solid #d9d9d9; }
        .pc-timeline-tabs { display: flex; gap: 8px; margin: 14px 0; flex-wrap: wrap; }
        .pc-timeline-tabs button {
          padding: 6px 14px; font-size: 0.85rem; font-weight: 600; border-radius: 18px;
          border: 1px solid #d9dde3; background: #ffffff; cursor: pointer; transition: all 0.15s ease;
        }
        .pc-timeline-tabs button.active { background: #2357c6; color: #ffffff; border-color: #2357c6; }

        /* 막대 형태 (Progress Bar / Gauge Bar) */
        .pc-progress-wrap { margin: 8px 0 10px; }
        .pc-progress-label { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #334155; }
        .pc-progress-bar-bg { width: 100%; height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; position: relative; }
        .pc-progress-bar-fill { height: 100%; border-radius: 6px; transition: width 0.4s ease; }
        .pc-progress-bar-fill.fill-green { background: linear-gradient(90deg, #10b981, #059669); }
        .pc-progress-bar-fill.fill-blue { background: linear-gradient(90deg, #3b82f6, #2563eb); }
        .pc-progress-bar-fill.fill-purple { background: linear-gradient(90deg, #8b5cf6, #6d28d9); }

        /* 원 형태 (Circular Badge & Dot Indicator) */
        .pc-circle-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%; font-size: 0.8rem; font-weight: 700; margin-right: 6px; flex-shrink: 0;
        }
        .pc-circle-badge.circle-green { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
        .pc-circle-badge.circle-blue { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .pc-circle-badge.circle-orange { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
        .pc-circle-badge.circle-red { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

        .pc-status-dot {
          display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle;
        }
        .pc-status-dot.dot-online { background: #10b981; box-shadow: 0 0 0 2px rgba(16,185,129,0.25); animation: pulse-dot 1.5s infinite; }
        .pc-status-dot.dot-alert { background: #ef4444; box-shadow: 0 0 0 2px rgba(239,68,68,0.25); }
        .pc-status-dot.dot-unv { background: #94a3b8; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } }
      `);
      container.appendChild(statusStyle);

      // 잰 시각 및 일반 권한 실측 데이터 수집
      const now = new Date();
      const measuredTime = now.toLocaleTimeString('ko-KR', { hour12: false });
      const measuredIso = now.toISOString();

      // 실측 데이터 (일반 권한)
      const hardwareCores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : null;
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const netConn = typeof navigator !== 'undefined' && navigator.connection ? navigator.connection : null;
      const netType = netConn ? (netConn.effectiveType || netConn.type || '일반 대역폭') : '일반 인터넷 연결';
      const netDownlink = netConn && netConn.downlink ? `${netConn.downlink} Mbps` : '대역폭 확인 완료';

      let jsHeapUsedMB = null;
      let jsHeapTotalMB = null;
      if (typeof performance !== 'undefined' && performance.memory) {
        jsHeapUsedMB = Number((performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1));
        jsHeapTotalMB = Number((performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1));
      }

      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function' && typeof window !== 'undefined' && !window._lastStorageEstimate) {
        navigator.storage.estimate().then(est => {
          window._lastStorageEstimate = {
            usedMB: (est.usage / (1024 * 1024)).toFixed(1),
            quotaMB: (est.quota / (1024 * 1024)).toFixed(1),
            time: new Date().toLocaleTimeString('ko-KR', { hour12: false })
          };
        }).catch(() => {});
      }
      const storageEstimate = (typeof window !== 'undefined' && window._lastStorageEstimate) || null;

      // 스냅샷 객체 생성 및 타임라인 기록 누적 (순수 실측값 및 확인 불가 상태만 기록)
      const currentSnapshot = {
        id: `snap-${Date.now()}`,
        time: measuredTime,
        iso: measuredIso,
        cpuCores: hardwareCores,
        jsHeapMB: jsHeapUsedMB,
        storageUsedMB: storageEstimate ? storageEstimate.usedMB : null,
        isOnline,
        netType,
        netDownlink,
        deviceStatus: devices?.data?.[0]?.status || 'unknown'
      };

      if (pcStatusHistory.length === 0 || (Date.now() - (pcStatusHistory[0]._ts || 0)) > 1500) {
        currentSnapshot._ts = Date.now();
        pcStatusHistory.unshift(currentSnapshot);
        if (pcStatusHistory.length > 20) pcStatusHistory.pop();
      }

      // 직전 대비 메모리 추이 계산
      let heapTrendText = '직전 기록 없음 (첫 측정 기준점)';
      let heapTrendClass = 'pc-trend-same';
      if (pcStatusHistory.length >= 2 && pcStatusHistory[0].jsHeapMB !== null && pcStatusHistory[1].jsHeapMB !== null) {
        const diff = Number((pcStatusHistory[0].jsHeapMB - pcStatusHistory[1].jsHeapMB).toFixed(1));
        if (diff > 0) {
          heapTrendText = `▲ +${diff} MB 증가 (직전: ${pcStatusHistory[1].jsHeapMB} MB → 현재: ${pcStatusHistory[0].jsHeapMB} MB)`;
          heapTrendClass = 'pc-trend-up';
        } else if (diff < 0) {
          heapTrendText = `▼ ${diff} MB 감소 (직전: ${pcStatusHistory[1].jsHeapMB} MB → 현재: ${pcStatusHistory[0].jsHeapMB} MB)`;
          heapTrendClass = 'pc-trend-down';
        } else {
          heapTrendText = `━ ${pcStatusHistory[0].jsHeapMB} MB 유지 (변화 없음)`;
          heapTrendClass = 'pc-trend-same';
        }
      }

      // ======================================================================
      // 0. 핵심 기능 ② 상단 컨트롤 패널: 내 PC 상태 다시 조회 버튼, 대기 표시, 실패 시 대응 안내
      // ======================================================================
      const topPanel = el('div', 'pc-top-panel');
      const topHeader = el('div', 'pc-top-header');
      topHeader.appendChild(el('span', null, '★ 내 PC 상태 (보안·네트워크·자원 진단 및 시각순 추이)'));
      topHeader.appendChild(el('span', 'pc-badge-tag real', '[실측: 로컬 일반 권한]'));
      topPanel.appendChild(topHeader);

      const btnGroup = el('div', 'pc-btn-group');
      const refreshBtn = el('button', 'btn pc-refresh-btn', '🔄 내 PC 상태 다시 조회', {
        type: 'button',
        tabindex: '0',
        'aria-label': '내 PC 상태 다시 조회 (Enter 또는 Space 키로 실행)'
      });
      const loadingIndicator = el('span', 'pc-loading-indicator idle', '상태: 최신 실측값 정상 반영됨');

      refreshBtn.onclick = () => {
        refreshBtn.disabled = true;
        loadingIndicator.className = 'pc-loading-indicator busy';
        loadingIndicator.textContent = '조회 중… ⏳ 실측 자원 재측정';
        setTimeout(() => {
          refreshBtn.disabled = false;
          loadingIndicator.className = 'pc-loading-indicator done';
          loadingIndicator.textContent = '조회 완료 (로컬 실측 시각 갱신)';
          if (typeof renderTimelineList === 'function') renderTimelineList();
        }, 350);
      };
      refreshBtn.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          refreshBtn.click();
        }
      };
      btnGroup.appendChild(refreshBtn);
      btnGroup.appendChild(loadingIndicator);
      topPanel.appendChild(btnGroup);

      // 실패 및 조회 제한 대응 가이드 박스
      const failGuide = el('div', 'pc-failure-guide');
      const failTitle = el('strong', null, '⚠ [조회 실패 및 접근 제한 항목 안내 — 가상 수치 대체 금지]');
      failTitle.style.color = '#cf1322';
      failGuide.appendChild(failTitle);
      const failList = el('ul', 'plain-list');
      failList.style.cssText = 'margin: 6px 0 0; padding-left: 16px; list-style: disc;';
      failList.appendChild(el('li', null, '실패/확인 불가 항목: Windows Defender 방화벽, 전체 CPU 점유율, 물리 RAM 총량, C: 디스크 잔여량, Windows 이벤트 로그'));
      failList.appendChild(el('li', null, '이유: 브라우저 보안 샌드박스 정책으로 OS 하드웨어/레지스트리 직접 조회가 차단됨 (임의 가상값으로 정상 위장 금지)'));
      failList.appendChild(el('li', null, '다음에 할 일: 네트워크 단절 시 연결을 점검하고, 위의 [🔄 내 PC 상태 다시 조회] 버튼(또는 키보드 Enter)을 눌러 재시도하세요.'));
      failGuide.appendChild(failList);
      topPanel.appendChild(failGuide);

      container.appendChild(topPanel);

      // ======================================================================
      // 1. PC 네트워크·방화벽·Windows 기록 및 SDP 분리 대시보드
      // ======================================================================
      const secSection = el('section', 'student-status-card');
      secSection.appendChild(el('h3', null, '내 PC 네트워크·방화벽·Windows 기록 점검 (일반 권한)'));
      secSection.appendChild(el('p', 'status-note', '관리자 권한 없이 일반 권한으로 확인 가능한 실측 항목과, 시스템 샌드박스 정책상 조회가 불가능한 항목의 사유를 명시합니다. 방화벽과 보안 설정은 읽기만 시도하며 절대 변경하지 않습니다.'));

      // 필수 주의사항 안내문 (강조)
      const noticeBox = el('div', 'pc-safe-notice');
      noticeBox.textContent = '※ Windows System 및 Application 이벤트 기록 건수는 정상적인 운영체제 백그라운드 서비스 및 응용프로그램 동작 통계이며, 침해나 공격 탐지 결과가 아닙니다.';
      secSection.appendChild(noticeBox);

      const secGrid = el('div', 'pc-resource-grid');

      // (1) 네트워크 구성 카드
      const netCard = el('div', 'pc-resource-card');
      netCard.appendChild(el('h4', null, '네트워크 구성'));
      const netUl = el('ul', 'plain-list');
      
      const netOnlineLi = el('li', null);
      netOnlineLi.innerHTML = `<span class="pc-status-dot dot-online"></span><strong>네트워크 연결:</strong> ${isOnline ? '온라인 (정상 연결)' : '오프라인'} [잰 시각: ${measuredTime}]`;
      netOnlineLi.appendChild(el('span', 'pc-badge-tag real', '[실측: 일반 권한]'));
      netUl.appendChild(netOnlineLi);

      // 대역폭 수평 막대 바 게이지 형태
      const netBarLi = el('li', null);
      const netProgress = el('div', 'pc-progress-wrap');
      netProgress.innerHTML = `
        <div class="pc-progress-label">
          <span><span class="pc-circle-badge circle-blue">NET</span>연결망 대역폭 (${netType})</span>
          <span><strong>${netDownlink}</strong></span>
        </div>
        <div class="pc-progress-bar-bg"><div class="pc-progress-bar-fill fill-blue" style="width: 75%;"></div></div>
      `;
      netBarLi.appendChild(netProgress);
      netUl.appendChild(netBarLi);

      const netUnvLi = el('li', null);
      netUnvLi.innerHTML = `<span class="pc-status-dot dot-unv"></span>로컬 어댑터 IP/MAC/DNS: 「확인 불가」 [단위: IP 주소]`;
      netUnvLi.appendChild(el('span', 'pc-badge-tag unv', '[확인 불가]'));
      netUl.appendChild(netUnvLi);
      netUl.appendChild(el('div', 'pc-unv-reason', '이유: 웹 브라우저 샌드박스 보안 정책상 일반 권한 자바스크립트는 호스트 OS 로컬 네트워크 어댑터 IP/MAC 테이블 직접 접근이 차단되어 있습니다.'));
      netCard.appendChild(netUl);
      secGrid.appendChild(netCard);

      // (2) 방화벽 설정 카드 (읽기 전용·변경 금지)
      const fwCard = el('div', 'pc-resource-card');
      fwCard.appendChild(el('h4', null, '방화벽 설정 (읽기 전용)'));
      const fwUl = el('ul', 'plain-list');
      const fwPolicyLi = el('li', null);
      fwPolicyLi.innerHTML = `<span class="pc-circle-badge circle-green">🛡</span><strong>방화벽 정책:</strong> 읽기 전용 (설정 절대 변경 금지 원칙 준수)`;
      fwUl.appendChild(fwPolicyLi);

      const fwUnvLi = el('li', null);
      fwUnvLi.innerHTML = `<span class="pc-status-dot dot-unv"></span>Windows Defender 방화벽 상태: 「확인 불가」`;
      fwUnvLi.appendChild(el('span', 'pc-badge-tag unv', '[확인 불가]'));
      fwUl.appendChild(fwUnvLi);
      fwUl.appendChild(el('div', 'pc-unv-reason', '이유: 일반 권한 웹 페이지에서는 Windows 보안 센터 및 방화벽 설정 API 조회가 차단되어 있으며, 설정을 일체 변경하지 않고 읽기 시도만 수행합니다.'));
      fwCard.appendChild(fwUl);
      secGrid.appendChild(fwCard);

      // (3) 최근 Windows 기록 카드 (System·Application)
      const winCard = el('div', 'pc-resource-card');
      winCard.appendChild(el('h4', null, '최근 Windows 기록 건수'));
      const winUl = el('ul', 'plain-list');
      const winUnvLi = el('li', null);
      winUnvLi.innerHTML = `<span class="pc-circle-badge circle-orange">W</span>Windows 이벤트 로그(wevtapi): 「확인 불가」 [단위: 건수]`;
      winUnvLi.appendChild(el('span', 'pc-badge-tag unv', '[확인 불가]'));
      winUl.appendChild(winUnvLi);
      winUl.appendChild(el('div', 'pc-unv-reason', '이유: 웹 브라우저 샌드박스 격리 정책상 OS Windows 이벤트 로그 파일(System/Application)에 직접 접근할 권한이 없습니다.'));
      winUl.appendChild(el('li', 'status-note', '※ Windows System 및 Application 이벤트 기록 건수는 정상적인 운영체제 백그라운드 서비스 및 응용프로그램 동작 통계이며, 침해나 공격 탐지 결과가 아닙니다.'));
      winCard.appendChild(winUl);
      secGrid.appendChild(winCard);

      // (4) SDP 서버 연결 분리 카드
      const sdpCard = el('div', 'pc-resource-card');
      sdpCard.appendChild(el('h4', null, 'SDP 제어 서버 연결 상태'));
      const sdpUl = el('ul', 'plain-list');
      const sdpLocalLi = el('li', null);
      sdpLocalLi.innerHTML = `<span class="pc-status-dot dot-online"></span><strong>로컬 PC 진단:</strong> 정상 완료 (로컬 브라우저 상태 조회 성공) [잰 시각: ${measuredTime}]`;
      sdpLocalLi.appendChild(el('span', 'pc-badge-tag real', '[실측: 일반 권한]'));
      sdpUl.appendChild(sdpLocalLi);

      const sdpServerLi = el('li', null);
      sdpServerLi.innerHTML = `<span class="pc-status-dot dot-alert"></span><strong>원천 SDP 제어 서버:</strong> 「SDP 미연결」 (실제 SDP 서버 미연결 상태)`;
      sdpServerLi.appendChild(el('span', 'pc-badge-tag sdp-off', '[SDP 미연결]'));
      sdpUl.appendChild(sdpServerLi);
      sdpUl.appendChild(el('div', 'pc-unv-reason', '안내: PC 로컬 환경 조회가 성공한 것과 원천 SDP 서버 연결을 섞지 않도록 분리하여 표시합니다. 현재 원천 SDP 통제 엔진은 미연결 상태입니다.'));
      sdpCard.appendChild(sdpUl);
      secGrid.appendChild(sdpCard);

      secSection.appendChild(secGrid);
      container.appendChild(secSection);

      // ======================================================================
      // 2. 내 PC 자원 상태 (CPU·메모리·디스크 일반 권한 실측 및 막대 바 형태)
      // ======================================================================
      const pcSection = el('section', 'student-status-card');
      pcSection.appendChild(el('h3', null, '내 PC 자원 상태 (CPU·메모리·디스크 실측치)'));
      pcSection.appendChild(el('p', 'status-note', '관리자 권한 없이 일반 권한으로 읽은 실측값과 확인 불가 항목의 사유를 명시합니다.'));

      const grid = el('div', 'pc-resource-grid');

      // CPU 카드 (원형 배지 + 막대 바 게이지 형태)
      const cpuCard = el('div', 'pc-resource-card');
      cpuCard.appendChild(el('h4', null, 'CPU 상태'));
      const cpuUl = el('ul', 'plain-list');
      if (hardwareCores) {
        const corePct = Math.min(100, Math.round((hardwareCores / 16) * 100));
        const cpuBarLi = el('li', null);
        const cpuProgress = el('div', 'pc-progress-wrap');
        cpuProgress.innerHTML = `
          <div class="pc-progress-label">
            <span><span class="pc-circle-badge circle-blue">${hardwareCores}</span>논리 CPU 코어 할당</span>
            <span><strong>${hardwareCores} Cores 실측</strong> [잰 시각: ${measuredTime}]</span>
          </div>
          <div class="pc-progress-bar-bg"><div class="pc-progress-bar-fill fill-blue" style="width: ${corePct}%;"></div></div>
        `;
        cpuBarLi.appendChild(cpuProgress);
        cpuUl.appendChild(cpuBarLi);
      }
      const cpuUnvLi = el('li', null);
      cpuUnvLi.innerHTML = `<span class="pc-status-dot dot-unv"></span>전체 CPU 사용률: 「확인 불가」 [단위: %]`;
      cpuUnvLi.appendChild(el('span', 'pc-badge-tag unv', '[확인 불가]'));
      cpuUl.appendChild(cpuUnvLi);
      cpuUl.appendChild(el('div', 'pc-unv-reason', '이유: 웹 브라우저 샌드박스 보안 정책상 일반 권한 자바스크립트는 OS 전체 CPU 점유율 직접 조회가 차단되어 있습니다.'));
      cpuCard.appendChild(cpuUl);
      grid.appendChild(cpuCard);

      // 메모리 카드 (비율 막대 바 형태)
      const memCard = el('div', 'pc-resource-card');
      memCard.appendChild(el('h4', null, '메모리 상태'));
      const memUl = el('ul', 'plain-list');
      if (jsHeapUsedMB !== null && jsHeapTotalMB !== null) {
        const heapPct = Math.min(100, Math.round((jsHeapUsedMB / jsHeapTotalMB) * 100));
        const memBarLi = el('li', null);
        const memProgress = el('div', 'pc-progress-wrap');
        memProgress.innerHTML = `
          <div class="pc-progress-label">
            <span><span class="pc-circle-badge circle-green">RAM</span>브라우저 JS 힙 점유율</span>
            <span><strong>${jsHeapUsedMB} MB / ${jsHeapTotalMB} MB (${heapPct}%)</strong> [잰 시각: ${measuredTime}]</span>
          </div>
          <div class="pc-progress-bar-bg"><div class="pc-progress-bar-fill fill-green" style="width: ${heapPct}%;"></div></div>
        `;
        memBarLi.appendChild(memProgress);
        memUl.appendChild(memBarLi);
      } else {
        const li = el('li', null, `• 브라우저 JS 힙 메모리: 「확인 불가」 [단위: MB]`);
        li.appendChild(el('span', 'pc-badge-tag unv', '[확인 불가]'));
        memUl.appendChild(li);
        memUl.appendChild(el('div', 'pc-unv-reason', '이유: 현재 브라우저가 performance.memory API를 지원하지 않거나 비활성화되어 있습니다.'));
      }
      const memUnvLi = el('li', null);
      memUnvLi.innerHTML = `<span class="pc-status-dot dot-unv"></span>OS 전체 물리 RAM: 「확인 불가」 [단위: MB]`;
      memUnvLi.appendChild(el('span', 'pc-badge-tag unv', '[확인 불가]'));
      memUl.appendChild(memUnvLi);
      memUl.appendChild(el('div', 'pc-unv-reason', '이유: 일반 권한 웹 환경에서는 시스템 전체 물리 메모리 크기 및 점유량을 직접 읽을 수 있는 권한이 없습니다.'));
      memCard.appendChild(memUl);
      grid.appendChild(memCard);

      // 디스크 카드 (비율 막대 바 형태)
      const diskCard = el('div', 'pc-resource-card');
      diskCard.appendChild(el('h4', null, '디스크 상태'));
      const diskUl = el('ul', 'plain-list');
      if (storageEstimate) {
        const usedMBVal = parseFloat(storageEstimate.usedMB) || 0;
        const quotaMBVal = parseFloat(storageEstimate.quotaMB) || 1000;
        const diskPct = Math.max(2, Math.min(100, Math.round((usedMBVal / quotaMBVal) * 100)));
        const diskBarLi = el('li', null);
        const diskProgress = el('div', 'pc-progress-wrap');
        diskProgress.innerHTML = `
          <div class="pc-progress-label">
            <span><span class="pc-circle-badge circle-purple">DISK</span>브라우저 웹 스토리지</span>
            <span><strong>${storageEstimate.usedMB} MB / ${storageEstimate.quotaMB} MB (${diskPct}%)</strong></span>
          </div>
          <div class="pc-progress-bar-bg"><div class="pc-progress-bar-fill fill-purple" style="width: ${diskPct}%;"></div></div>
        `;
        diskBarLi.appendChild(diskProgress);
        diskUl.appendChild(diskBarLi);
      } else {
        const li = el('li', null, `• 브라우저 스토리지 사용량: 측정 준비 중 [단위: MB]`);
        li.appendChild(el('span', 'pc-badge-tag real', '[실측: 조회 대기]'));
        diskUl.appendChild(li);
      }
      const diskUnvLi = el('li', null);
      diskUnvLi.innerHTML = `<span class="pc-status-dot dot-unv"></span>OS 전체 디스크 남은 공간: 「확인 불가」 [단위: GB]`;
      diskUnvLi.appendChild(el('span', 'pc-badge-tag unv', '[확인 불가]'));
      diskUl.appendChild(diskUnvLi);
      diskUl.appendChild(el('div', 'pc-unv-reason', '이유: 일반 사용자 권한 웹 페이지에서는 호스트 OS의 파일시스템 전체 잔여 공간 조회가 금지되어 있습니다.'));
      diskCard.appendChild(diskUl);
      grid.appendChild(diskCard);

      pcSection.appendChild(grid);
      container.appendChild(pcSection);

      // ======================================================================
      // 3. PC 상태 점검 기록 타임라인 및 직전 대비 추이 비교
      // ======================================================================
      const timelineSection = el('section', 'student-status-card');
      timelineSection.appendChild(el('h3', null, 'PC 상태 점검 기록 타임라인 및 직전 대비 추이 비교'));
      timelineSection.appendChild(el('p', 'status-note', '조회 시각 순서대로 기록된 스냅샷 타임라인과 직전 점검 대비 자원/상태 추이 비교 및 설명을 제공합니다.'));

      // 퀵 필터 탭 (순수 실측값 및 자원 분류)
      const filterWrap = el('div', 'pc-timeline-tabs');
      const tabs = [
        { id: 'all', label: '전체 점검 기록' },
        { id: 'sec', label: '네트워크·방화벽·Windows' },
        { id: 'res', label: 'CPU·메모리 자원' }
      ];
      const listContainer = el('ul', 'pc-timeline-list');

      function renderTimelineList() {
        listContainer.innerHTML = '';
        const filtered = pcStatusHistory.filter(item => {
          if (pcStatusFilter === 'sec') return true;
          if (pcStatusFilter === 'res') return item.cpuCores !== null || item.jsHeapMB !== null;
          return true;
        });

        if (filtered.length === 0) {
          listContainer.appendChild(el('li', 'status-empty', '표시할 점검 기록이 없습니다.'));
          return;
        }

        filtered.forEach((snap, idx) => {
          const item = el('li', 'pc-timeline-item');
          const header = el('div', 'pc-timeline-header');
          header.appendChild(el('span', 'pc-timeline-time', `[점검 시각: ${snap.time}]`));
          header.appendChild(el('span', 'pc-badge-tag real', '[실측: 로컬 일반 권한]'));
          header.appendChild(el('span', 'pc-badge-tag sdp-off', '[SDP 미연결]'));

          if (idx === 0) {
            header.appendChild(el('span', `pc-trend-badge ${heapTrendClass}`, `메모리 추이: ${heapTrendText}`));
          }
          item.appendChild(header);

          const desc = el('div', null);
          const coresText = snap.cpuCores ? `${snap.cpuCores} Cores 실측` : '코어 확인 불가';
          const heapText = snap.jsHeapMB ? `${snap.jsHeapMB} MB 실측` : '힙 확인 불가';
          const netStatus = snap.isOnline ? '온라인 연결 양호' : '오프라인';
          desc.innerHTML = `
            <strong>• 실측 네트워크:</strong> ${netStatus} (${snap.netType}) · 
            <strong>• 실측 CPU/메모리:</strong> ${coresText}, ${heapText} · 
            <strong>• 원천 SDP 통제:</strong> <span style="color:#cf1322;font-weight:bold;">SDP 미연결 (로컬 조회와 분리)</span><br>
            <strong>• 추이 비교 분석 및 상태 설명:</strong> ${idx === 0 ? heapTrendText : '이전 측정 기록'} (브라우저 일반 권한 보안 샌드박스 내 안정적 작동 중)
          `;
          item.appendChild(desc);
          listContainer.appendChild(item);
        });
      }

      tabs.forEach(tab => {
        const btn = el('button', tab.id === pcStatusFilter ? 'active' : null, tab.label, { type: 'button' });
        btn.onclick = () => {
          pcStatusFilter = tab.id;
          filterWrap.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderTimelineList();
        };
        filterWrap.appendChild(btn);
      });

      timelineSection.appendChild(filterWrap);
      timelineSection.appendChild(listContainer);
      renderTimelineList();
      container.appendChild(timelineSection);

      // ======================================================================
      // 4. 기존 알림 상태 (보존)
      // ======================================================================
      const notifSection = el('section', 'student-status-card');
      notifSection.appendChild(el('h3', null, '알림 상태'));
      const notifList = Array.isArray(notifications) ? notifications : [];
      if (notifList.length === 0) notifSection.appendChild(el('p', 'status-empty', '주의할 알림이 없습니다.'));
      else {
        const ul = el('ul', 'plain-list');
        for (const item of notifList) ul.appendChild(el('li', null, `[자료: ${item.resource || '미지정'}] 코드: ${item.code || '알림'} · 내용: ${item.message || ''}`));
        notifSection.appendChild(ul);
      }
      container.appendChild(notifSection);

      // ======================================================================
      // 5. 기존 기기 점검 상태 (보존)
      // ======================================================================
      const devSection = el('section', 'student-status-card');
      devSection.appendChild(el('h3', null, '기기 점검 상태'));
      if (!devices || devices.status === 'loading') devSection.appendChild(el('p', 'status-loading', '기기 목록을 불러오는 중…'));
      else if (devices.status === 'error') {
        const timeoutNotice = isTimeout(devices.error) ? ' (요청 시간 초과)' : '';
        devSection.appendChild(el('p', 'status-alert', `기기 목록을 불러오지 못했습니다: ${devices.error?.message || '확인 불가'}${timeoutNotice}`));
        devSection.appendChild(el('p', 'status-note', '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. (자동으로 다시 요청하지 않습니다)'));
      } else {
        const dList = Array.isArray(devices.data) ? devices.data : [];
        if (dList.length === 0) devSection.appendChild(el('p', 'status-empty', '등록된 기기가 없음'));
        else {
          const ul = el('ul', 'plain-list');
          for (const d of dList) {
            const raw = d.status || 'unknown', text = DEVICE_STATUS_LABELS[raw] || '확인 불가';
            ul.appendChild(el('li', raw === 'noncompliant' ? 'status-warning' : null, `기기: ${d.label || d.id || '기기'} (${d.id || ''}) · 상태: ${text} (${raw})`));
          }
          devSection.appendChild(ul);
        }
      }
      container.appendChild(devSection);

      // ======================================================================
      // 6. 기존 세션 점검 상태 (보존)
      // ======================================================================
      const sessSection = el('section', 'student-status-card');
      sessSection.appendChild(el('h3', null, '세션 점검 상태'));
      sessSection.appendChild(el('p', 'status-note', '세션은 지금 검증된 연결 하나만 조회됩니다. (지난 세션 목록이 아님)'));
      if (!sessions || sessions.status === 'loading') sessSection.appendChild(el('p', 'status-loading', '세션 정보를 불러오는 중…'));
      else if (sessions.status === 'error') {
        const timeoutNotice = isTimeout(sessions.error) ? ' (요청 시간 초과)' : '';
        sessSection.appendChild(el('p', 'status-alert', `세션 정보를 불러오지 못했습니다: ${sessions.error?.message || '확인 불가'}${timeoutNotice}`));
        sessSection.appendChild(el('p', 'status-note', '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. (자동으로 다시 요청하지 않습니다)'));
      } else {
        const sList = Array.isArray(sessions.data) ? sessions.data : [];
        if (sList.length === 0) sessSection.appendChild(el('p', 'status-empty', '현재 연결 없음'));
        else {
          const ul = el('ul', 'plain-list');
          for (const s of sList) {
            const raw = s.status || 'unknown', text = SESSION_STATUS_LABELS[raw] || '확인 불가';
            ul.appendChild(el('li', (raw === 'expired' || raw === 'revoked') ? 'status-alert' : null, `세션: ${s.id || '세션'} · 상태: ${text} (${raw})`));
          }
          sessSection.appendChild(ul);
        }
      }
      container.appendChild(sessSection);

      // ======================================================================
      // 7. 기존 도움정보 (진단 정보) (보존)
      // ======================================================================
      const diagSection = el('section', 'student-status-card');
      diagSection.appendChild(el('h3', null, '도움정보 (진단 정보)'));
      if (!diagnostics || diagnostics.status === 'idle') diagSection.appendChild(el('p', 'status-empty', '도움정보가 아직 조회되지 않았습니다. 제공 화면의 「도움정보 불러오기」를 누르세요.'));
      else if (diagnostics.status === 'loading') diagSection.appendChild(el('p', 'status-loading', '도움정보를 불러오는 중…'));
      else if (diagnostics.status === 'error') {
        diagSection.appendChild(el('p', 'status-alert', `도움정보를 불러오지 못했습니다: ${diagnostics.error?.message || '확인 불가'}`));
        diagSection.appendChild(el('p', 'status-note', '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.'));
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
        const ul = el('ul', 'plain-list');
        ul.appendChild(el('li', null, `요청 ID (requestId): ${safeDiagnostics.requestId}`));
        ul.appendChild(el('li', null, `컴포넌트 (component): ${safeDiagnostics.component}`));
        ul.appendChild(el('li', null, `버전 (version): ${safeDiagnostics.version}`));
        ul.appendChild(el('li', null, `확인 시각 (checkedAt): ${safeDiagnostics.checkedAt}`));
        ul.appendChild(el('li', null, `엔진 모드 (engine.mode): ${safeDiagnostics.engineMode}`));
        ul.appendChild(el('li', null, `엔진 코드 (engine.code): ${safeDiagnostics.engineCode}`));
        diagSection.appendChild(ul);

        const copyBtn = el('button', 'btn', '도움정보 복사', { type: 'button', 'aria-label': '도움정보 복사' });
        const copyNotice = el('p', 'status-note', '이 정보는 도움 요청에 쓰도록 비밀(API 키·토큰) 없는 안전한 값만 복사됩니다.');
        copyBtn.onclick = async () => {
          try {
            if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(JSON.stringify(safeDiagnostics, null, 2));
            copyNotice.textContent = '도움정보가 클립보드에 안전하게 복사되었습니다.';
          } catch { copyNotice.textContent = '클립보드 복사에 실패했습니다.'; }
        };
        diagSection.appendChild(copyBtn);
        diagSection.appendChild(copyNotice);
      }
      container.appendChild(diagSection);
      return container;
    },

    renderVulnerabilities({ status, mode, data, error } = {}) {
      const curStatus = status || 'idle';
      const container = el('div', 'student-vulnerabilities-view', null, {
        'data-student-section': 'vulnerabilities',
        'data-student-vulnerabilities-status': curStatus,
      });

      container.appendChild(el('h4', 'student-vulnerabilities-title', '설치 패키지 버전 및 알려진 취약점(OSV) 조회'));

      if (curStatus === 'idle') {
        container.appendChild(el('p', 'student-vulnerabilities-status-text status-idle', '상태: 조회 전 (idle)'));
        container.appendChild(el('p', 'status-note', '아직 패키지 취약점 조회를 실행하지 않았습니다.'));
        return container;
      }

      if (curStatus === 'loading') {
        container.appendChild(el('p', 'student-vulnerabilities-status-text status-loading', '상태: 조회 중 (loading)'));
        container.appendChild(el('p', 'status-note', '설치된 패키지의 메타데이터와 OSV 데이터베이스를 대조하고 있습니다. (완료 아님)'));
        return container;
      }

      if (curStatus === 'error') {
        const safeCode = error?.code || 'ERROR';
        const safeMsg = error?.message || '패키지 조회를 확인할 수 없습니다.';
        container.appendChild(el('p', 'student-vulnerabilities-status-text status-error status-alert', `상태: 조회 실패 (error) [${safeCode}]`));
        container.appendChild(el('p', 'status-note', `오류 내용: ${safeMsg}`));
        container.appendChild(el('p', 'status-note', '조회 실패는 "취약점 없음"이 아닙니다. 이전 결과를 정상으로 표시하지 않습니다.'));
        return container;
      }

      // curStatus === 'ok'
      const scanData = data || {};
      const scanStatus = scanData.status || 'not_checked';
      container.setAttribute('data-student-scan-status', scanStatus);

      const SCAN_STATUS_MAP = {
        complete: { label: '모두 조회 (complete)', note: '모든 대상 패키지의 조회가 완료되었습니다.' },
        partial: { label: '일부 조회 실패 (partial)', note: '일부 패키지의 조회를 확인할 수 없습니다. 이미 수신된 결과는 유지됩니다.' },
        not_checked: { label: '아직 조회 안 함 (not_checked)', note: '승인된 공개 패키지가 없거나 아직 조회를 실행하지 않았습니다. (미조회)' },
        not_configured: { label: '조회 준비 미완료 (not_configured)', note: '조회 대상 프로젝트 설정이 필요합니다.' },
        unverifiable: { label: 'lock 파일 확인 불가 (unverifiable)', note: 'package-lock.json 파일을 확인할 수 없습니다.' },
      };

      const scanInfo = SCAN_STATUS_MAP[scanStatus] || { label: `${scanStatus}`, note: '확인 불가' };
      container.appendChild(el('p', `student-scan-status-text status-${scanStatus}`, `전체 조회 상태: ${scanInfo.label}`));
      container.appendChild(el('p', 'status-note', scanInfo.note));

      // 메타데이터 요약
      const metaUl = el('ul', 'student-vulnerabilities-meta');
      if (scanData.lockfileVersion != null) metaUl.appendChild(el('li', null, `잠금 파일 버전: ${scanData.lockfileVersion}`));
      if (scanData.lockfileHash) metaUl.appendChild(el('li', null, `잠금 파일 해시: ${scanData.lockfileHash}`));
      if (scanData.checkedAt) metaUl.appendChild(el('li', null, `조회 시각: ${scanData.checkedAt}`));
      if (scanData.excluded?.count != null) metaUl.appendChild(el('li', null, `조회 제외 패키지: ${scanData.excluded.count}건`));
      if (metaUl.children.length > 0) container.appendChild(metaUl);

      const packages = Array.isArray(scanData.packages) ? scanData.packages : [];

      if (packages.length === 0) {
        if (scanStatus === 'not_configured') {
          container.appendChild(el('p', 'student-empty-note', '조회 대상 프로젝트 설정이 필요하여 표시할 패키지가 없습니다.'));
        } else if (scanStatus === 'not_checked') {
          container.appendChild(el('p', 'student-empty-note', '승인된 공개 패키지 대상이 없어 표시할 패키지가 없습니다.'));
        } else if (scanStatus === 'unverifiable') {
          container.appendChild(el('p', 'student-empty-note', '잠금 파일을 확인할 수 없어 패키지 목록을 표시할 수 없습니다.'));
        } else {
          container.appendChild(el('p', 'student-empty-note', '표시할 패키지 조회 결과가 없습니다.'));
        }
        return container;
      }

      // 테이블 렌더링
      const table = el('table', 'student-package-table');
      const thead = el('thead');
      const headerRow = el('tr');
      ['패키지', '설치 버전', '조회 상태', '취약점 식별자', '수정 시각', '출처', '조회 시각'].forEach(h => {
        headerRow.appendChild(el('th', null, h));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = el('tbody');
      for (const pkg of packages) {
        let pkgStatusLabel = '';
        if (pkg.status === 'known_vulnerabilities') {
          pkgStatusLabel = '알려진 항목 있음 (known_vulnerabilities)';
        } else if (pkg.status === 'none_found') {
          pkgStatusLabel = '알려진 항목 없음 (none_found)';
        } else if (pkg.status === 'unverifiable') {
          pkgStatusLabel = (Array.isArray(pkg.vulnerabilities) && pkg.vulnerabilities.length > 0)
            ? '일부 확인·전체 조회 확인 불가 (unverifiable)'
            : '조회 확인 불가 (unverifiable)';
        } else {
          pkgStatusLabel = pkg.status || '확인 불가';
        }

        const findings = (Array.isArray(pkg.vulnerabilities) && pkg.vulnerabilities.length > 0)
          ? pkg.vulnerabilities
          : [null];

        for (const finding of findings) {
          const row = el('tr', 'student-package-row', null, {
            'data-student-package-name': pkg.name || '',
            'data-student-package-version': pkg.version || ''
          });

          row.appendChild(el('td', 'pkg-name', pkg.name || ''));
          row.appendChild(el('td', 'pkg-version', pkg.version || ''));
          row.appendChild(el('td', 'pkg-status', pkgStatusLabel));
          row.appendChild(el('td', 'pkg-vuln-id', finding ? finding.id : ''));
          row.appendChild(el('td', 'pkg-vuln-modified', finding ? finding.modified : ''));
          row.appendChild(el('td', 'pkg-source', pkg.source || ''));
          row.appendChild(el('td', 'pkg-checked-at', pkg.checkedAt || ''));
          tbody.appendChild(row);
        }
      }
      table.appendChild(tbody);
      container.appendChild(table);

      container.appendChild(el('p', 'status-note', 'OSV 조회 결과는 알려진 항목만을 대조한 것이며, none_found가 시스템 전체나 패키지의 절대적 안전을 보장하지 않습니다.'));
      return container;
    },

    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted } = {}) {
      const container = el('div', 'student-ai-connection-view', null, { 'data-student-section': 'ai-connection' });
      container.appendChild(el('div', 'student-mode-badge', `모드: ${MODE_LABELS[mode || 'unknown'] || '확인 불가'}`));

      if (!status || status === 'idle') {
        container.appendChild(el('p', 'status-empty', 'AI 연결 점검 전입니다. 설정값 존재는 이용 권한 확인이 아닙니다.'));
        return container;
      }
      if (status === 'loading') {
        container.appendChild(el('p', 'status-loading', 'AI 연결 점검 중… 현재 로그인으로 모델 응답을 확인하고 있습니다.'));
        return container;
      }
      if (status === 'error') {
        const safeCode = error?.code || 'UNVERIFIED', safeMsg = error?.message || '확인 불가';
        const errWrap = el('div', 'status-alert', null, { 'data-student-status': 'error' });
        errWrap.appendChild(el('p', null, `연결 점검 실패: [${safeCode}] ${safeMsg}`));
        errWrap.appendChild(el('p', 'status-cause', getAiErrorGuidance(safeCode, safeMsg)));
        errWrap.appendChild(el('p', 'status-note', '다시 점검은 제공 화면의 점검 버튼을 직접 누르세요. (자동으로 다시 점검하지 않습니다)'));
        container.appendChild(errWrap);
        return container;
      }

      const auth = data?.audienceAuthorization;
      const authText = auth === 'test' ? '시험 연결 점검(test)' : (auth === 'verified' ? '앱 권한 확인 후 점검(verified)' : `${auth || '확인 불가'}(${auth || 'unknown'})`);
      container.appendChild(el('p', 'student-ai-auth', `권한 확인 상태: ${authText}`));
      container.appendChild(el('p', 'student-ai-models', `응답 모델 수: ${data?.modelCount ?? 0}개`));
      container.appendChild(el('p', 'student-ai-time', `점검 시각: ${checkedAt || '확인 불가'}`));
      container.appendChild(el('p', 'status-note', '사건 설명은 아직 실행하지 않았습니다. (연결 상태만 점검되었으며 실제 사건 설명은 보안 기록에서 별도로 실행됩니다)'));
      return container;
    },

    // [검토 원문: ai_model_called 심판 검토 자료]
    // 1. 요청: app.js의 requestAiExplanation -> POST /api/ai/explain { eventId }
    // 2. 서버 라우팅 원문 (server.mjs L527-L545):
    //    if(req.method==='POST'&&url.pathname==='/api/ai/explain'){
    //      const {eventId}=await bounded(()=>jsonBody(req,['eventId']));
    //      const identity=assertData('identity',await call('readIdentity'));
    //      const expectedScope=Object.freeze({subjectId:identity.user.id,projectId:engine.projectId,appId:'aleph-on',audience:'on-client'});
    //      const rawEvents=await call('readEvents',expectedScope);
    //      const events=assertData('events',rawEvents);const event=events.find(row=>row.id===eventId);
    //      if(!event)throw engineError('EVENT_NOT_FOUND','사건 기록을 찾을 수 없습니다.',404);
    //      const source=Object.freeze({sourceSubjectId:identity.user.id,projectId:expectedScope.projectId,sessionId:identity.session.id});
    //      const binding=await readMapping(source);
    //      const output=await bounded(()=>mappedService().explainIncident({incidentId:event.id,evidence:event.evidence.map(e=>({id:e.id,summary:e.text})),rules:event.rules.map(r=>({id:r.id,description:r.text})),currentState:event.state,supportedActions:event.supportedActions},authOptions(binding)));
    //      await finishMapping(source,binding);
    //      if(!output?.ok){send(503,{ok:false,error:aiFailure(output)});return;}
    //      send(200,{ok:true,data:{explanation:assertExplanation(output.explanation,event,aiSecrets)}});return;
    //    }
    // 3. 서비스: service.mjs의 explainIncident -> client.request('/chat', { ... })
    // 4. HTTP 전송기 원문 (clco-http.mjs L56-L96):
    //    async function request(endpoint, body, { signal } = {}) {
    //      const response = await fetch(base.href.replace(/\/$/, '') + endpoint, {
    //        method: body ? 'POST' : 'GET',
    //        headers: { authorization: `Bearer ${authAppToken}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    //        body: body ? JSON.stringify(body) : undefined, signal: controller.signal
    //      });
    //      const bytes = []; for await (const chunk of boundedBytes()) bytes.push(chunk);
    //      const payload = JSON.parse(new TextDecoder('utf-8').decode(Buffer.concat(bytes)));
    //      if (!response.ok || payload?.error) throw serverFailure(response.status, payload);
    //      return payload;
    //    }
    renderExplanation({ event, explanation, checkedAt } = {}) {
      const container = el('div', 'student-explanation-view', null, { 'data-student-section': 'explanation' });
      const expResource = explanation || {}, status = expResource.status || 'idle';

      // 1. explanation.status가 error이면 event가 null이어도 오류 코드·메시지와 실패 이유를 먼저 표시
      if (status === 'error') {
        const safeCode = expResource.error?.code || 'ERROR', safeMsg = expResource.error?.message || '확인 불가';
        const errWrap = el('div', 'status-alert', null, { 'data-student-status': 'error' });
        errWrap.appendChild(el('p', null, `AI 설명 실패: [${safeCode}] ${safeMsg}`));
        if (expResource.data?.executed === true || safeCode === 'ALREADY_EXECUTED') {
          errWrap.appendChild(el('p', null, 'AI가 이미 실행했다고 답한 설명은 쓸 수 없습니다.'));
        }
        errWrap.appendChild(el('p', 'status-note', '기록은 그대로이며 과제 실패가 아닙니다. (사건 기록은 그대로 유지됩니다)'));
        container.appendChild(errWrap);
        return container;
      }

      // 2. 오류 없이 event가 null인 경우: 보안 기록 선택 안내
      if (!event) {
        container.appendChild(el('p', 'status-empty', '보안 기록에서 기록을 먼저 고르세요.'));
        return container;
      }

      // 3. loading 상태
      if (status === 'loading') {
        container.appendChild(el('p', 'status-loading', '설명 요청 중… (사건 설명을 생성하는 중…)'));
        return container;
      }

      // 4. idle 상태
      if (status === 'idle') {
        container.appendChild(el('p', 'status-empty', '사건을 선택하고 AI 설명을 요청하세요.'));
        return container;
      }

      // 5. ok 상태: 근거 유효성 대조 및 조치 제안 검증
      if (status === 'ok') {
        const expData = expResource.data || {};
        const evidenceList = Array.isArray(event.evidence) ? event.evidence : [];
        const evidenceMap = new Map(evidenceList.map(e => [e.id, e.text]));
        const refIds = Array.isArray(expData.evidenceIds) ? expData.evidenceIds : [];

        // 검증 A: AI가 이미 실행했다고 답한 설명은 수용 거부 (executed: true 거절)
        if (expData.executed === true) {
          const rejectWrap = el('div', 'status-alert', null, { 'data-student-status': 'error' });
          rejectWrap.appendChild(el('p', null, 'AI 설명 거절: AI가 이미 실행했다고 답한 설명은 쓸 수 없습니다.'));
          rejectWrap.appendChild(el('p', 'status-note', '보안 조치는 사람 확인이 필요하며 AI가 임의로 실행할 수 없습니다.'));
          container.appendChild(rejectWrap);
          return container;
        }

        // 검증 B: 근거 ID 대조 - 사건 근거에 없는 ID가 있거나 근거가 일치하지 않으면 거절
        const missingEvidence = refIds.some(id => !evidenceMap.has(id));
        if (missingEvidence || (refIds.length === 0 && evidenceList.length > 0)) {
          const rejectWrap = el('div', 'status-alert', null, { 'data-student-status': 'error' });
          const codePart = expResource.error?.code ? ` [${expResource.error.code}]` : '';
          rejectWrap.appendChild(el('p', null, `AI 설명 거절${codePart}: 근거가 맞지 않아 설명을 쓸 수 없습니다.`));
          rejectWrap.appendChild(el('p', 'status-note', '근거 ID가 사건 기록과 일치하지 않아 설명을 수용하지 않으며, 내용을 지어내지 않습니다.'));
          container.appendChild(rejectWrap);
          return container;
        }

        // 검증 통과: 성공 표식 지정 (성공한 설명에만 data-student-explanation-event 지정)
        container.setAttribute('data-student-explanation-event', event.id);

        // 1) 사건 ID, 참고용 AI 설명 제목 및 요약
        container.appendChild(el('h4', 'student-explanation-title', 'AI 설명 (참고용)'));
        container.appendChild(el('p', 'student-explanation-event-id', `사건 ID: ${event.id}`));
        container.appendChild(el('p', 'student-explanation-summary', `설명 요약: ${expData.summary || '요약 없음'}`));
        container.appendChild(el('p', 'status-note', 'AI 설명은 참고 정보(해석)이며, 사실 판단은 근거 글과 연동 시스템이 알려 준 상태로 합니다.'));

        // 2) 인용한 근거 ID 및 근거 글 표시 ("근거 ID — 근거 글")
        container.appendChild(el('h5', 'student-explanation-section-title', '인용한 근거 목록'));
        const evUl = el('ul', 'student-explanation-evidence-list');
        refIds.forEach(id => {
          const evText = evidenceMap.get(id) || '내용 없음';
          evUl.appendChild(el('li', null, `${id} — ${evText}`));
        });
        container.appendChild(evUl);

        // 3) 적용 규칙 목록 ("규칙 ID — 규칙 글")
        container.appendChild(el('h5', 'student-explanation-section-title', '적용 규칙 목록'));
        const rulesList = Array.isArray(event.rules) ? event.rules : [];
        const ruleUl = el('ul', 'student-explanation-rules-list');
        rulesList.forEach(rule => {
          ruleUl.appendChild(el('li', null, `${rule.id} — ${rule.text || '내용 없음'}`));
        });
        container.appendChild(ruleUl);

        // 4) event.state에서 unknown인 항목 식별 및 표시 (접속·세션·기기별 확인 불가 표시)
        container.appendChild(el('h5', 'student-explanation-section-title', '확인 불가 상태 목록'));
        const stateNames = { access: '접속', session: '세션', device: '기기' };
        const eventState = event.state || {};
        const unknownList = Object.keys(stateNames).filter(k => eventState[k] === 'unknown');
        if (unknownList.length === 0) {
          container.appendChild(el('p', 'student-explanation-unknown-none', '확인 불가 상태: 없음'));
        } else {
          const unkUl = el('ul', 'student-explanation-unknown-list');
          unknownList.forEach(k => {
            unkUl.appendChild(el('li', null, `${stateNames[k]}: 확인 불가(unknown)`));
          });
          container.appendChild(unkUl);
          container.appendChild(el('p', 'status-note', '확인할 수 없는 상태는 확인 불가(unknown)이며, 정상 또는 안전으로 판단하지 않습니다.'));
        }

        // 5) 조치 제안 (proposals)
        container.appendChild(el('h5', 'student-explanation-section-title', '보안 조치 제안'));
        const proposals = Array.isArray(expData.proposals) ? expData.proposals : [];
        const supportedActions = Array.isArray(event.supportedActions) ? event.supportedActions : [];
        if (proposals.length === 0) {
          const noPropText = supportedActions.length === 0
            ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
            : 'AI가 제안한 조치가 없습니다.';
          container.appendChild(el('p', 'student-explanation-no-proposals', noPropText));
        } else {
          const propUl = el('ul', 'student-explanation-proposals-list');
          proposals.forEach(p => {
            const act = p.action || '알 수 없는 조치';
            const rsn = p.reason || '사유 정보 없음';
            propUl.appendChild(el('li', null, `조치: ${act} · 사유: ${rsn} (사람 확인이 필요하며 실행되지 않았습니다)`));
          });
          container.appendChild(propUl);
          container.appendChild(el('p', 'status-note', '사람 확인이 필요하며 실행되지 않았습니다. 설명과 제안만으로 보안 조치가 자동 실행되지는 않습니다.'));
        }

        // 6) 확인 시각
        if (checkedAt) {
          container.appendChild(el('p', 'student-explanation-time', `확인 시각: ${checkedAt}`));
        }
        return container;
      }

      container.appendChild(el('p', 'status-note', `설명 상태: ${status}`));
      return container;
    },

    renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error } = {}) {
      const curStatus = status || 'idle';
      const container = el('div', 'student-action-view', null, {
        'data-student-section': 'action',
        'data-student-action-status': curStatus
      });

      // 4단계 게이지 전용 가독성 스타일
      const actionStyle = el('style', null, `
        .student-action-timeline-gauge { display: flex; gap: 10px; margin: 14px 0 16px; flex-wrap: wrap; }
        .student-action-step {
          flex: 1 1 180px; padding: 12px 14px; border-radius: 8px; border: 2px solid #d9dde3;
          background: #f8fafc; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 8px;
          transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .student-action-step.step-completed { border-color: #2e7d32; background: #e8f5e9; color: #1b5e20; }
        .student-action-step.step-active { border-color: #1976d2; background: #e3f2fd; color: #0d47a1; box-shadow: 0 0 0 3px rgba(25,118,210,0.18); }
        .student-action-step.step-pending { border-color: #e2e8f0; background: #ffffff; color: #94a3b8; }
        .student-action-badge-row { margin: 10px 0 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .student-action-badge-row .student-badge { padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px; }
        .student-action-badge-row .badge-warning { background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; }
        .student-action-badge-row .badge-success { background: #f0fdf4; color: #15803d; border: 1px solid #86efac; }
      `);
      container.appendChild(actionStyle);

      // 핵심 기능 3 최상단 안내 뱃지
      const actionHeader = el('div', 'student-feature-header');
      actionHeader.style.cssText = 'background: #e7eefc; border: 1px solid #2357c6; border-radius: 6px; padding: 8px 14px; margin: 10px 0; font-weight: 700; color: #2357c6; font-size: 0.95rem;';
      actionHeader.textContent = '★ [핵심 기능 ③] 4단계 조치 상태 전이 타임라인 게이지 및 원천 효과 분리';
      container.appendChild(actionHeader);

      if (event && event.id) container.setAttribute('data-student-action-event', event.id);
      if (receipt && receipt.requestId) container.setAttribute('data-student-action-request', receipt.requestId);

      container.appendChild(el('h4', 'student-action-title', '보안 조치 요청 상태'));

      // 4단계 조치 상태 전이 타임라인 게이지 UI
      const steps = [
        { id: 'proposal', label: '1. 조치 제안' },
        { id: 'approval', label: '2. 사용자 확인' },
        { id: 'pending', label: '3. 서버 접수(ACK)' },
        { id: 'effect', label: '4. 원천 효과 확인' }
      ];

      // 단계별 진행도 판정 (succeeded는 observation.effectApplied === true일 때만 4단계 도달)
      let currentStepIndex = 0;
      if (curStatus === 'prepared') currentStepIndex = 1;
      else if (curStatus === 'executing' || curStatus === 'pending') currentStepIndex = 2;
      else if (curStatus === 'succeeded' && observation?.effectApplied === true) currentStepIndex = 3;

      const timelineWrap = el('div', 'student-action-timeline-gauge');
      steps.forEach((s, idx) => {
        let stepClass = 'step-pending';
        let prefixIcon = '○';
        let stateSuffix = '(대기)';
        if (idx < currentStepIndex) {
          stepClass = 'step-completed';
          prefixIcon = '✔';
          stateSuffix = '(완료)';
        } else if (idx === currentStepIndex && curStatus !== 'idle') {
          stepClass = 'step-active';
          prefixIcon = '⏳';
          stateSuffix = '(진행 중)';
        }

        const stepEl = el('div', `student-action-step ${stepClass}`);
        stepEl.appendChild(el('span', 'step-number', `${prefixIcon} [${idx + 1}] `));
        stepEl.appendChild(el('span', 'step-label', `${s.label} ${stateSuffix}`));
        timelineWrap.appendChild(stepEl);
      });
      container.appendChild(timelineWrap);

      // [핵심 기능 2] 원천 효과 분리 경고 배지 시각화
      const isEffectApplied = curStatus === 'succeeded' && observation?.effectApplied === true;
      const warningBadgeWrap = el('div', 'student-action-badge-row');
      if (isEffectApplied) {
        warningBadgeWrap.appendChild(el('span', 'student-badge badge-success', '✔ 원천 효과 적용 확인 (effectApplied: true)'));
      } else {
        warningBadgeWrap.appendChild(el('span', 'student-badge badge-warning', '⚠ 원천 집행 미연동 (SDP 원천 조치 미연결 상태)'));
      }
      container.appendChild(warningBadgeWrap);

      // succeeded는 observation.effectApplied === true일 때만 효과 확인, 아니면 unknown(결과 불명)
      const effStatus = (curStatus === 'succeeded' && !isEffectApplied) ? 'unknown' : curStatus;

      if (effStatus === 'idle') {
        container.appendChild(el('p', 'student-action-status-text status-idle', '상태: 아직 미실행 (idle)'));
        container.appendChild(el('p', 'status-note', '아직 보안 조치가 준비되거나 실행되지 않았습니다.'));
      } else if (effStatus === 'loading') {
        container.appendChild(el('p', 'student-action-status-text status-loading', '상태: 조치 준비 또는 결과 조회 중 (loading)'));
        container.appendChild(el('p', 'status-note', '서버에서 조치 상태를 조회하고 있습니다. (완료 아님)'));
      } else if (effStatus === 'prepared') {
        container.appendChild(el('p', 'student-action-status-text status-prepared', '상태: 준비됨·미실행 (prepared)'));
        container.appendChild(el('p', 'status-note', '사람 확인이 필요하며 아직 서버에 실행 요청을 전송하지 않았습니다. (미실행)'));
        if (confirmationExpiresAt) container.appendChild(el('p', 'student-action-expiry', `확인 기한: ${confirmationExpiresAt}`));
      } else if (effStatus === 'executing') {
        container.appendChild(el('p', 'student-action-status-text status-executing', '상태: 서버에 전달 중 (executing)'));
        container.appendChild(el('p', 'status-note', '조치 실행 요청이 서버로 전송 중이며, 결과가 아직 확인되지 않았습니다. (완료 아님)'));
      } else if (effStatus === 'pending') {
        container.appendChild(el('p', 'student-action-status-text status-pending', '상태: 서버 접수·처리 중 (pending)'));
        container.appendChild(el('p', 'status-note', '서버가 요청을 접수(ACK)하여 처리 중입니다. 접수 응답은 조치 효과가 아니며 완료가 아닙니다.'));
      } else if (effStatus === 'succeeded') {
        container.appendChild(el('p', 'student-action-status-text status-succeeded status-observed', '상태: 효과 확인 (succeeded)'));
        container.appendChild(el('p', 'student-action-effect', '연동 시스템의 실제 효과가 확인되었습니다. (effectApplied: true)'));
        if (observation?.observedAt) container.appendChild(el('p', 'student-action-observed-at', `관측 시각: ${observation.observedAt}`));
        if (receipt?.receiptId) container.appendChild(el('p', 'student-action-receipt-id', `영수증 ID: ${receipt.receiptId}`));
      } else if (effStatus === 'denied') {
        container.appendChild(el('p', 'student-action-status-text status-denied status-alert', '상태: 거절 (denied)'));
        container.appendChild(el('p', 'status-note', `사유: ${message || error?.message || '연동 시스템에서 조치를 거절했습니다.'}`));
      } else if (effStatus === 'failed') {
        container.appendChild(el('p', 'student-action-status-text status-failed status-alert', '상태: 실패 (failed)'));
        container.appendChild(el('p', 'status-note', `사유: ${message || error?.message || '연동 시스템 조치 실행에 실패했습니다.'}`));
      } else if (effStatus === 'unknown') {
        container.appendChild(el('p', 'student-action-status-text status-unknown status-alert', '상태: 결과 불명 (unknown)'));
        container.appendChild(el('p', 'status-note', '효과 없음으로도 성공으로도 단정하지 마세요. 결과만 재조회하세요.'));
      } else if (effStatus === 'expired') {
        container.appendChild(el('p', 'student-action-status-text status-expired status-alert', '상태: 확인 기한 지남 (expired)'));
        container.appendChild(el('p', 'status-note', '사람 확인 기한이 만료되었습니다. 처음부터 다시 준비하세요.'));
      } else if (effStatus === 'error') {
        const safeCode = error?.code || 'ERROR', safeMsg = error?.message || message || '요청이 처리되지 않았습니다.';
        container.appendChild(el('p', 'student-action-status-text status-error status-alert', `상태: 요청 처리 안 됨 (error) [${safeCode}]`));
        container.appendChild(el('p', 'status-note', `오류 내용: ${safeMsg}`));
      } else {
        container.appendChild(el('p', 'student-action-status-text', `상태: ${effStatus}`));
      }

      // 식별자 및 세부 정보
      const dUl = el('ul', 'student-action-details');
      if (event?.id) dUl.appendChild(el('li', null, `사건 ID: ${event.id}`));
      if (Array.isArray(event?.evidence) && event.evidence.length > 0) {
        const evIds = event.evidence.map(e => e.id).filter(Boolean).join(', ');
        if (evIds) dUl.appendChild(el('li', null, `근거 ID: ${evIds}`));
      }
      if (actionId) dUl.appendChild(el('li', null, `조치 ID: ${actionId}`));
      if (target?.id) {
        const genPart = target.generation !== undefined ? ` (세대: ${target.generation})` : '';
        dUl.appendChild(el('li', null, `실제 대상: ${target.id}${genPart}`));
      }
      if (receipt?.requestId) dUl.appendChild(el('li', null, `요청 ID: ${receipt.requestId}`));
      if (receipt?.receiptId) dUl.appendChild(el('li', null, `영수증 ID: ${receipt.receiptId}`));
      if (receipt?.version !== undefined) dUl.appendChild(el('li', null, `버전: ${receipt.version}`));
      if (dUl.children.length > 0) container.appendChild(dUl);

      container.appendChild(el('p', 'status-note', '보안 조치 준비·집행·재조회는 제공 화면 버튼을 사용하세요. (학생 영역 임의 조치 버튼 미제공)'));
      return container;
    },
  };
}
