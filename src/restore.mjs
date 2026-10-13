import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  const scope = [];
  if (currentVersion !== restoreVersion) {
    scope.push(`버전 변경: ${currentVersion} -> ${restoreVersion}`);
  }
  if (removedRules.length > 0) {
    scope.push(`비인가/변조 규칙 제거: [${removedRules.join(', ')}]`);
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
      removed: removedRules,
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
    ruleIds: ['device_registered', 'unauthorized_backdoor_rule'],
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
    process.stdout.write('【변경 범위 (Scope of Changes)】\n');
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

// 직접 CLI 실행 시 동작
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    previewPolicyRestore();
  } catch (error) {
    process.stderr.write(`복원 미리보기 중단: ${error.message}\n`);
    process.exitCode = 1;
  }
}
