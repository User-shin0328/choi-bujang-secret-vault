import config from '../aleph.config.json' with { type: 'json' };

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  let body = request.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { action, email, password } = body || {};

  if (!email || !password) {
    return response.status(400).json({ error: '이메일과 비밀번호를 모두 입력해 주세요.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || config.identityProvider?.issuer?.replace(/\/auth\/v1$/u, '');
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_YRJgWCiyxTxGvM81uZZu-w_66OxefD8';

  try {
    if (action === 'signup') {
      const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return response.status(res.status).json({ error: data.msg || data.message || '가입 실패' });
      }
      return response.status(200).json({
        token: data.access_token || null,
        user: data.user,
      });
    }

    // Default: 로그인 (signInWithPassword)
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return response.status(res.status).json({
        error: data.error_description || data.msg || data.message || '로그인 실패',
      });
    }
    return response.status(200).json({
      token: data.access_token,
      user: data.user,
    });
  } catch (err) {
    return response.status(500).json({ error: err.message || '서버 오류' });
  }
}
