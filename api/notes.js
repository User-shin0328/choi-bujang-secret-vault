import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import config from '../aleph.config.json' with { type: 'json' };

let cachedVerifier = null;
let cachedSecretKey = null;

function getVerifier(secretKey) {
  if (!cachedVerifier || cachedSecretKey !== secretKey) {
    cachedVerifier = createLoginVerifier({
      config,
      supabaseSecretKey: secretKey,
    });
    cachedSecretKey = secretKey;
  }
  return cachedVerifier;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || config.identityProvider?.issuer?.replace(/\/auth\/v1$/u, '');
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseSecretKey || !config?.identityProvider) {
    return response.status(500).json({ error: 'SERVER_CONFIG_MISSING' });
  }

  // 1. 요청 토큰 검사: 브라우저가 보낸 userId·role은 신뢰하지 않고 토큰 서명만 검증
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  let authUser;
  try {
    const verifyLogin = getVerifier(supabaseSecretKey);
    authUser = await verifyLogin(authHeader);
  } catch {
    return response.status(500).json({ error: 'AUTH_VERIFICATION_FAILED' });
  }

  // 토큰이 없거나 검사에 실패하면 자료 없이 401 거부
  if (!authUser) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  // 2. 인증 통과 시 (정상 A 로그인 또는 심판 A/B 토큰) DB 자료 조회
  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await supabase
      .from('notes')
      .select('title, content')
      .order('created_at', { ascending: true });

    if (error) {
      return response.status(502).json({ error: 'NOTES_FETCH_FAILED' });
    }

    return response.status(200).json({
      notes: data ?? [],
    });
  } catch {
    return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

