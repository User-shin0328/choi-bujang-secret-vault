import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, resetBindings } from './decider.mjs';

/**
 * 정책 객체의 핵심 필드에 대한 무결성 SHA-256 해시를 계산합니다.
 */
export function calculatePolicyChecksum(policy) {
  if (!policy || typeof policy !== 'object') return '';
  const payload = JSON.stringify({
    policyRevision: policy.policyRevision ?? policy.version ?? 1,
    ruleIds: Array.isArray(policy.ruleIds) ? [...policy.ruleIds] : [],
    allowedRoutes: Array.isArray(policy.allowedRoutes) ? [...policy.allowedRoutes] : [],
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * 침해 전에 검증된 안전 정책 사본을 다시 읽고 무결성을 검증합니다.
 * 사본이 없거나 검증 실패 시 즉시 에러를 발생시키고 작업을 중단합니다.
 */
export function verifyPolicyBackup(backupSource) {
  let data;
  if (typeof backupSource === 'string') {
    const resolvedPath = resolve(process.cwd(), backupSource);
    if (!existsSync(resolvedPath)) {
      throw new Error(`사본이 존재하지 않습니다: [${backupSource}] 복원을 중단합니다.`);
    }
    try {
      const raw = readFileSync(resolvedPath, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      throw new Error(`사본을 읽거나 파싱하는 데 실패했습니다: ${err.message}. 복원을 중단합니다.`);
    }
  } else if (backupSource && typeof backupSource === 'object') {
    data = backupSource;
  } else {
    throw new Error('사본이 존재하지 않거나 유효하지 않습니다. 복원을 중단합니다.');
  }

  // 필수 필드 및 검증 플래그 확인
  if (data.verified !== true) {
    throw new Error('사본이 검증된 안전 정책이 아닙니다 (verified !== true). 복원을 중단합니다.');
  }
  if (!Array.isArray(data.ruleIds) || data.ruleIds.length === 0) {
    throw new Error('사본의 규칙 목록이 비어 있거나 올바르지 않습니다. 복원을 중단합니다.');
  }
  if (typeof data.policyRevision !== 'number' && typeof data.version !== 'number') {
    throw new Error('사본에 유효한 버전/리비전 정보가 없습니다. 복원을 중단합니다.');
  }

  // 해시 체크섬 검증
  const expectedChecksum = calculatePolicyChecksum(data);
  if (!data.checksum || data.checksum !== expectedChecksum) {
    throw new Error('사본 체크섬 검증 실패: 무결성이 훼손된 사본이므로 복원을 중단합니다.');
  }

  return data;
}

/**
 * 검증된 안전 정책 사본과 현재 시험 정책 간의 차이(diff)를 계산합니다.
 */
export function diffPolicy(safePolicy, testPolicy) {
  if (!safePolicy || typeof safePolicy !== 'object') {
    throw new Error('검증된 안전 정책 사본이 제공되지 않았습니다.');
  }
  if (!testPolicy || typeof testPolicy !== 'object') {
    throw new Error('비교할 현재 시험 정책이 제공되지 않았습니다.');
  }

  const restoreVersion = safePolicy.policyRevision ?? safePolicy.version ?? 1;
  const currentVersion = testPolicy.policyRevision ?? testPolicy.version ?? 'unknown';

  const safeRules = Array.isArray(safePolicy.ruleIds) ? safePolicy.ruleIds : [];
  const testRules = Array.isArray(testPolicy.ruleIds) ? testPolicy.ruleIds : [];

  const addedRules = safeRules.filter(r => !testRules.includes(r));
  const removedRules = testRules.filter(r => !safeRules.includes(r));
  const preservedRules = safeRules.filter(r => testRules.includes(r));

  const safeRoutes = Array.isArray(safePolicy.allowedRoutes) ? safePolicy.allowedRoutes : [];
  const testRoutes = Array.isArray(testPolicy.allowedRoutes) ? testPolicy.allowedRoutes : [];

  const addedRoutes = safeRoutes.filter(r => !testRoutes.includes(r));
  const removedRoutes = testRoutes.filter(r => !safeRoutes.includes(r));

  const unauthorizedRules = removedRules.filter(r => /^(unauthorized|bypass|backdoor|exploit|disable_)/iu.test(r));
  const otherServiceRules = removedRules.filter(r => !/^(unauthorized|bypass|backdoor|exploit|disable_)/iu.test(r));

  const scope = [];
  if (currentVersion !== restoreVersion) {
    scope.push(`버전 변경: ${currentVersion} -> ${restoreVersion}`);
  }
  if (unauthorizedRules.length > 0) {
    scope.push(`비인가/변조 규칙 제거: [${unauthorizedRules.join(', ')}]`);
  }
  if (otherServiceRules.length > 0) {
    scope.push(`다른 서비스 규칙 보존 유지: [${otherServiceRules.join(', ')}]`);
  }
  if (addedRules.length > 0) {
    scope.push(`누락된 안전 규칙 복원: [${addedRules.join(', ')}]`);
  }
  if (removedRoutes.length > 0) {
    scope.push(`비인가 경로 제거: [${removedRoutes.join(', ')}]`);
  }
  if (addedRoutes.length > 0) {
    scope.push(`안전 경로 복원: [${addedRoutes.join(', ')}]`);
  }

  return {
    restoreVersion,
    currentVersion,
    ruleDiff: {
      added: addedRules,
      removed: unauthorizedRules,
      preservedOther: otherServiceRules,
      preserved: preservedRules,
    },
    routeDiff: {
      added: addedRoutes,
      removed: removedRoutes,
    },
    scope,
    hasChanges: scope.length > 0,
  };
}

/**
 * 복원 전 안전 정책 사본을 검증하고, 현재 시험 정책과의 버전 및 변경 범위를 미리 보여줍니다.
 * 실제 운영 정책 파일은 절대 수정하지 않습니다.
 */
export function previewPolicyRestore({
  backupPath = 'backup/verified-policy.json',
  testPolicy = null,
  verbose = true,
} = {}) {
  // 1. 사본을 다시 읽어 검증 (사본 없거나 검증 실패 시 예외 던지고 중단)
  const safePolicy = verifyPolicyBackup(backupPath);

  // 2. 비교 대상 시험 정책 (미지정 시 가상 침해 시험 정책 사용)
  const candidatePolicy = testPolicy ?? {
    version: 2,
    policyRevision: 2,
    ruleIds: [
      'device_registered',
      'unauthorized_backdoor_rule',
      'other_service_metrics_rule',
    ],
    allowedRoutes: [
      'GET /api/notes',
      'POST /api/notes',
      'GET /api/admin/unrestricted',
    ],
  };

  // 3. 차이점 계산
  const diff = diffPolicy(safePolicy, candidatePolicy);

  // 4. 복원할 버전과 변경 범위 표시
  if (verbose) {
    process.stdout.write('========================================\n');
    process.stdout.write('【안전 정책 사본 검증 및 변경 범위 미리보기】\n');
    process.stdout.write('========================================\n');
    process.stdout.write(`• 사본 무결성: 검증 완료 (체크섬 일치)\n`);
    process.stdout.write(`• 복원할 버전: revision ${diff.restoreVersion}\n`);
    process.stdout.write(`• 현재 시험 버전: revision ${diff.currentVersion}\n`);
    process.stdout.write('----------------------------------------\n');
    process.stdout.write('【실행 전 바뀔 항목 확인 (Scope of Changes)】\n');
    if (diff.scope.length === 0) {
      process.stdout.write('  (변경 사항 없음: 이미 사본과 동일합니다)\n');
    } else {
      for (const item of diff.scope) {
        process.stdout.write(`  - ${item}\n`);
      }
    }
    process.stdout.write('----------------------------------------\n');
    process.stdout.write(`• 유지되는 안전 규칙: [${diff.ruleDiff.preserved.join(', ')}]\n`);
    process.stdout.write(`• 실제 운영 정책 수정 여부: 미수정 (보존됨, dry-run)\n`);
    process.stdout.write('========================================\n');
  }

  return {
    success: true,
    restoreVersion: diff.restoreVersion,
    currentVersion: diff.currentVersion,
    diff,
    operationalPolicyModified: false,
  };
}

/**
 * 감사 이력(Audit Logs)을 읽어옵니다. 파일이 없으면 빈 배열을 반환합니다.
 */
export function loadAuditLogs(auditLogPath = 'backup/audit-log.json') {
  const resolved = resolve(process.cwd(), auditLogPath);
  if (!existsSync(resolved)) return [];
  try {
    const raw = readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 새 감사 이벤트를 추가하여 기존 이력을 보존한 채로 저장합니다.
 */
export function appendAuditLog(auditLogPath = 'backup/audit-log.json', event) {
  const resolved = resolve(process.cwd(), auditLogPath);
  const existing = loadAuditLogs(auditLogPath);
  const updated = [...existing, event];
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return updated;
}

/**
 * 검증된 안전 정책 버전으로 시험 정책을 되돌립니다.
 * - 사본이 없거나 검증 실패 시 작업을 중단합니다.
 * - 실행 전에 바뀔 항목을 미리 확인합니다.
 * - 다른 서비스 규칙과 감사 이력은 반드시 보존합니다.
 */
export function restorePolicy({
  backupPath = 'backup/verified-policy.json',
  testPolicy = null,
  auditLogPath = 'backup/audit-log.json',
  verbose = true,
} = {}) {
  // 1. 사본 다시 읽어 검증 (사본 없거나 검증 실패 시 중단)
  const safePolicy = verifyPolicyBackup(backupPath);

  // 2. 현재 시험 정책 준비 (미지정 시 가상 침해 시험 정책 사용)
  const currentTestPolicy = testPolicy ?? {
    version: 2,
    policyRevision: 2,
    ruleIds: [
      'device_registered',
      'unauthorized_backdoor_rule',
      'other_service_metrics_rule',
    ],
    allowedRoutes: [
      'GET /api/notes',
      'POST /api/notes',
      'GET /api/admin/unrestricted',
    ],
  };

  // 3. 실행 전에 바뀔 항목 확인 (Diff 계산)
  const diff = diffPolicy(safePolicy, currentTestPolicy);

  if (verbose) {
    process.stdout.write('========================================\n');
    process.stdout.write('【1. 실행 전 바뀔 항목 확인】\n');
    process.stdout.write('========================================\n');
    process.stdout.write(`• 복원 대상 버전: revision ${diff.restoreVersion}\n`);
    process.stdout.write(`• 현재 시험 버전: revision ${diff.currentVersion}\n`);
    if (diff.scope.length === 0) {
      process.stdout.write('  (바뀔 항목 없음: 이미 안전 정책 버전과 동일)\n');
    } else {
      for (const item of diff.scope) {
        process.stdout.write(`  - ${item}\n`);
      }
    }
    process.stdout.write('----------------------------------------\n');
  }

  // 4. 다른 서비스 규칙 보존
  // 침해/비인가 패턴(unauthorized_*, bypass_*, backdoor_*)을 제외한 다른 서비스 규칙은 보존
  const otherServiceRules = (currentTestPolicy.ruleIds || []).filter(rule => {
    if (safePolicy.ruleIds.includes(rule)) return false;
    if (/^(unauthorized|bypass|backdoor|exploit|disable_)/iu.test(rule)) return false;
    return true; // 다른 서비스 규칙 보존!
  });

  const restoredRuleIds = [...safePolicy.ruleIds, ...otherServiceRules];

  // 5. 감사 이력 보존 및 새 복원 이벤트 기록 (S10_AUDIT_DROPPED 방어)
  const auditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action: 'restore_test_policy',
    at: new Date().toISOString(),
    restoredVersion: diff.restoreVersion,
    previousVersion: diff.currentVersion,
    scopeOfChanges: diff.scope,
    preservedOtherServiceRules: otherServiceRules,
    restoredRuleIds,
    status: 'success',
  };

  const updatedAuditLogs = appendAuditLog(auditLogPath, auditEvent);

  // 6. 복원된 시험 정책 생성
  const restoredPolicy = {
    version: safePolicy.version,
    policyRevision: safePolicy.policyRevision,
    verified: true,
    ruleIds: restoredRuleIds,
    allowedRoutes: [...safePolicy.allowedRoutes],
    checksum: safePolicy.checksum,
    restoredAt: auditEvent.at,
  };

  if (verbose) {
    process.stdout.write('【2. 시험 정책 되돌리기 완료】\n');
    process.stdout.write('----------------------------------------\n');
    process.stdout.write(`• 복원된 규칙 목록: [${restoredRuleIds.join(', ')}]\n`);
    process.stdout.write(`• 보존된 다른 서비스 규칙: [${otherServiceRules.join(', ') || '없음'}]\n`);
    process.stdout.write(`• 감사 이력 누적: 총 ${updatedAuditLogs.length}건 보존 완료\n`);
    process.stdout.write('========================================\n');
  }

  return {
    restoredPolicy,
    diff,
    auditLogs: updatedAuditLogs,
  };
}

/**
 * 복원 후 B의 A 자료 요청 거부 및 A 정상 요청 유지를 검증합니다.
 */
export async function verifyPolicyEnforcement(restoredPolicy, { verbose = true } = {}) {
  resetBindings();

  // 1. 사용자 A의 정상 요청 (본인 메모 /notes/1 조회)
  const reqA = {
    requestId: randomUUID(),
    at: new Date().toISOString(),
    policyRevision: restoredPolicy?.policyRevision ?? 1,
    subjectId: 'user_a',
    deviceId: 'device_a_1',
    deviceRegistered: true,
    service: 'notes',
    method: 'GET',
    path: '/notes/1',
    signals: { network: 'usual', hour: 14 },
  };

  // 2. 사용자 B의 A 자료 요청 (타인 메모 /notes/1 접근 시도)
  const reqB = {
    requestId: randomUUID(),
    at: new Date().toISOString(),
    policyRevision: restoredPolicy?.policyRevision ?? 1,
    subjectId: 'user_b',
    deviceId: 'device_b_1',
    deviceRegistered: true,
    service: 'notes',
    method: 'GET',
    path: '/notes/1',
    signals: { network: 'usual', hour: 14 },
  };

  const resA = await decide(reqA);
  const resB = await decide(reqB);

  const passedA = resA.decision === 'allow' && resA.reasonCode === 'approved';
  const passedB = resB.decision === 'deny' && resB.reasonCode === 'zone_forbidden';

  if (verbose) {
    process.stdout.write('【3. 복원 후 접근 제어 판정 검증】\n');
    process.stdout.write('----------------------------------------\n');
    process.stdout.write(`• A 정상 요청: ${passedA ? '통과 (allow · approved)' : `실패 (${resA.decision} · ${resA.reasonCode})`}\n`);
    process.stdout.write(`• B의 A 자료 요청: ${passedB ? '거부 통과 (deny · zone_forbidden)' : `실패 (${resB.decision} · ${resB.reasonCode})`}\n`);
    process.stdout.write('========================================\n');
  }

  if (!passedA || !passedB) {
    throw new Error(`복원 후 접근 제어 검증 실패 (A 결과: ${resA.decision}, B 결과: ${resB.decision})`);
  }

  return {
    passed: true,
    resultA: resA,
    resultB: resB,
  };
}

// 직접 CLI 실행 시 동작
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { restoredPolicy } = restorePolicy();
    await verifyPolicyEnforcement(restoredPolicy);
  } catch (error) {
    process.stderr.write(`복원 절차 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
