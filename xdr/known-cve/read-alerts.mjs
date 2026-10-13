import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_FIXTURE_PATH = resolve(__dirname, '..', 'fixtures', 'known-cve.json');

// 비밀값 패턴 검사 및 마스킹 (토큰, 비밀키, 패스워드 패턴 등)
const SECRET_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{16,}|\bsb_secret_[A-Za-z0-9_-]{12,}|\bsk-[A-Za-z0-9_-]{20,}|\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}|password\s*[:=]\s*\S+|pwd\s*[:=]\s*\S+/giu;

function sanitize(value) {
  if (typeof value !== 'string') return value ?? '';
  return value.replaceAll(SECRET_PATTERN, '[REDACTED]');
}

/**
 * Wazuh 경보 묶음에서 시각, 출발 주소, 계정, 규칙 수준, 설명만 추출합니다.
 */
export async function readAlerts(fixturePath = DEFAULT_FIXTURE_PATH) {
  const content = await readFile(fixturePath, 'utf8');
  const fixture = JSON.parse(content);
  if (!Array.isArray(fixture.alerts)) {
    throw new Error('경보 목록(alerts)이 올바르지 않습니다.');
  }

  return fixture.alerts.map((alert) => {
    const timestamp = sanitize(alert.timestamp || '-');
    const srcip = sanitize(alert.data?.srcip || '-');
    const srcuser = sanitize(alert.data?.srcuser || alert.data?.user || alert.data?.dstuser || alert.data?.accounts || '-');
    const level = alert.rule?.level ?? '-';
    const description = sanitize(alert.rule?.description || '-');

    return {
      timestamp,
      srcip,
      srcuser,
      level,
      description,
    };
  });
}

/**
 * 단일 경보를 한 줄 문자열로 포맷팅합니다.
 */
export function formatAlert(alert) {
  return `${alert.timestamp} | ${alert.srcip} | ${alert.srcuser} | 레벨 ${alert.level} | ${alert.description}`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isMain) {
  const targetPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_FIXTURE_PATH;
  try {
    const alerts = await readAlerts(targetPath);
    for (const alert of alerts) {
      console.log(formatAlert(alert));
    }
  } catch (err) {
    console.error('경보 읽기 실패:', err.message);
    process.exitCode = 1;
  }
}
