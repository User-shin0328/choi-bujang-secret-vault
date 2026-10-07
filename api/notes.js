import { randomUUID } from 'node:crypto';
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

  const method = request.method || 'GET';
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
    response.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  // 1. 요청 토큰 검사: 브라우저가 보낸 userId·role은 신뢰하지 않고 토큰 유무부터 확인
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || config.identityProvider?.issuer?.replace(/\/auth\/v1$/u, '');
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseSecretKey || !config?.identityProvider) {
    return response.status(500).json({ error: 'SERVER_CONFIG_MISSING' });
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

  // 요청 경로에서 :id 추출 (query.id 또는 URL 정규식 분석)
  let id = request.query?.id;
  if (!id && request.url) {
    const urlPath = request.url.split('?')[0];
    const match = urlPath.match(/\/api\/notes\/([^/?#]+)/);
    if (match && match[1]) {
      id = decodeURIComponent(match[1]);
    }
  }

  // 본문 파싱
  let bodyData = request.body;
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch { bodyData = {}; }
  }
  if (!bodyData || typeof bodyData !== 'object') {
    bodyData = {};
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // 2. 단건 GET (/api/notes/:id)
    if (method === 'GET' && id) {
      const { data: note, error } = await supabase
        .from('notes')
        .select('id, title, content')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return response.status(502).json({ error: 'NOTE_FETCH_FAILED' });
      }
      if (!note) {
        return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      }
      return response.status(200).json({
        id: note.id,
        title: note.title,
        body: note.content ?? '',
      });
    }

    // 3. 목록 GET (/api/notes)
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content, owner_id, created_at')
        .or(`owner_id.eq.${authUser.userId},owner_id.is.null`)
        .order('created_at', { ascending: true });

      if (error) {
        return response.status(502).json({ error: 'NOTES_FETCH_FAILED' });
      }

      const list = (data ?? []).map(note => ({
        id: note.id,
        title: note.title,
        body: note.content ?? '',
      }));
      return response.status(200).json(list);
    }

    // 4. 추가 POST (/api/notes)
    if (method === 'POST') {
      const noteId = bodyData.id || randomUUID();
      const title = bodyData.title ?? '';
      const bodyText = bodyData.body ?? bodyData.content ?? '';

      const { error } = await supabase
        .from('notes')
        .insert({
          id: noteId,
          title,
          content: bodyText,
          owner_id: authUser.userId,
        });

      if (error) {
        return response.status(502).json({ error: 'NOTE_INSERT_FAILED' });
      }

      if (!bodyData.id) {
        return response.status(201).json({ id: noteId });
      }
      return response.status(201).json({ id: noteId, title, body: bodyText });
    }

    // 5. 수정 PUT (/api/notes/:id)
    // 3단계에서는 아직 소유자 검사를 하지 않아 B가 A의 메모를 수정할 수 있음 (4단계에서 제한)
    if (method === 'PUT') {
      if (!id) {
        return response.status(400).json({ error: 'MISSING_NOTE_ID' });
      }

      const updateData = {};
      if (bodyData.title !== undefined) updateData.title = bodyData.title;
      if (bodyData.body !== undefined) updateData.content = bodyData.body;
      else if (bodyData.content !== undefined) updateData.content = bodyData.content;

      const { data: updated, error } = await supabase
        .from('notes')
        .update(updateData)
        .eq('id', id)
        .select('id, title, content')
        .maybeSingle();

      if (error) {
        return response.status(502).json({ error: 'NOTE_UPDATE_FAILED' });
      }
      if (!updated) {
        return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      }

      return response.status(200).json({
        id: updated.id,
        title: updated.title,
        body: updated.content ?? '',
      });
    }

    // 6. 삭제 DELETE (/api/notes/:id)
    // 3단계에서는 아직 소유자 검사를 하지 않음
    if (method === 'DELETE') {
      if (!id) {
        return response.status(400).json({ error: 'MISSING_NOTE_ID' });
      }

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) {
        return response.status(502).json({ error: 'NOTE_DELETE_FAILED' });
      }

      return response.status(200).json({ id, deleted: true });
    }
  } catch {
    return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

