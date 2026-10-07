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

// In-memory fallback notes store
const memoryNotes = new Map([
  ['1', { id: '1', title: '과제', body: '실습용 가상 과제 기록', owner_id: null }],
  ['2', { id: '2', title: '포트폴리오', body: '실습용 가상 포트폴리오 기록', owner_id: null }],
  ['3', { id: '3', title: '아침 리추얼', body: '실습용 가상 리추얼 기록', owner_id: null }],
  ['4', { id: '4', title: '훈련 행정 자료', body: '실습용 가상 행정 기록', owner_id: null }],
]);

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  const method = request.method || 'GET';
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
    response.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  // 1. 요청 토큰 검사: 토큰 헤더가 없으면 즉시 401 반환
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || config.identityProvider?.issuer?.replace(/\/auth\/v1$/u, '');
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || 'sb_publishable_YRJgWCiyxTxGvM81uZZu-w_66OxefD8';

  let authUser = null;
  try {
    const verifyLogin = getVerifier(supabaseSecretKey);
    authUser = await verifyLogin(authHeader);
  } catch {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
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

  const hasSecret = Boolean(process.env.SUPABASE_SECRET_KEY);
  const supabase = hasSecret
    ? createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

  try {
    // 2. 단건 GET (/api/notes/:id)
    if (method === 'GET' && id) {
      if (supabase) {
        try {
          const { data: note, error } = await supabase
            .from('notes')
            .select('id, title, content')
            .eq('id', id)
            .maybeSingle();

          if (!error && note) {
            return response.status(200).json({
              id: note.id,
              title: note.title,
              body: note.content ?? '',
            });
          }
          if (!error && !note) {
            return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
          }
        } catch { /* fallback to memory */ }
      }

      const memNote = memoryNotes.get(id);
      if (!memNote) {
        return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      }
      return response.status(200).json({
        id: memNote.id,
        title: memNote.title,
        body: memNote.body ?? '',
      });
    }

    // 3. 목록 GET (/api/notes)
    if (method === 'GET') {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('notes')
            .select('id, title, content, owner_id, created_at')
            .or(`owner_id.eq.${authUser.userId},owner_id.is.null`)
            .order('created_at', { ascending: true });

          if (!error && Array.isArray(data)) {
            const list = data.map(note => ({
              id: note.id,
              title: note.title,
              body: note.content ?? '',
            }));
            return response.status(200).json(list);
          }
        } catch { /* fallback to memory */ }
      }

      const list = Array.from(memoryNotes.values())
        .filter(n => !n.owner_id || n.owner_id === authUser.userId)
        .map(n => ({ id: n.id, title: n.title, body: n.body ?? '' }));
      return response.status(200).json(list);
    }

    // 4. 추가 POST (/api/notes)
    if (method === 'POST') {
      const noteId = bodyData.id || randomUUID();
      const title = bodyData.title ?? '';
      const bodyText = bodyData.body ?? bodyData.content ?? '';

      if (supabase) {
        try {
          await supabase.from('notes').insert({
            id: noteId,
            title,
            content: bodyText,
            owner_id: authUser.userId,
          });
        } catch { /* fallback to memory */ }
      }

      memoryNotes.set(noteId, { id: noteId, title, body: bodyText, owner_id: authUser.userId });

      if (!bodyData.id) {
        return response.status(201).json({ id: noteId });
      }
      return response.status(201).json({ id: noteId, title, body: bodyText });
    }

    // 5. 수정 PUT (/api/notes/:id)
    if (method === 'PUT') {
      if (!id) {
        return response.status(400).json({ error: 'MISSING_NOTE_ID' });
      }

      const updateTitle = bodyData.title;
      const updateBody = bodyData.body !== undefined ? bodyData.body : bodyData.content;

      if (supabase) {
        try {
          const updateData = {};
          if (updateTitle !== undefined) updateData.title = updateTitle;
          if (updateBody !== undefined) updateData.content = updateBody;

          const { data: updated, error } = await supabase
            .from('notes')
            .update(updateData)
            .eq('id', id)
            .select('id, title, content')
            .maybeSingle();

          if (!error && updated) {
            return response.status(200).json({
              id: updated.id,
              title: updated.title,
              body: updated.content ?? '',
            });
          }
        } catch { /* fallback to memory */ }
      }

      const existing = memoryNotes.get(id);
      if (!existing) {
        return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      }
      if (updateTitle !== undefined) existing.title = updateTitle;
      if (updateBody !== undefined) existing.body = updateBody;

      return response.status(200).json({
        id: existing.id,
        title: existing.title,
        body: existing.body ?? '',
      });
    }

    // 6. 삭제 DELETE (/api/notes/:id)
    if (method === 'DELETE') {
      if (!id) {
        return response.status(400).json({ error: 'MISSING_NOTE_ID' });
      }

      if (supabase) {
        try {
          await supabase.from('notes').delete().eq('id', id);
        } catch { /* fallback to memory */ }
      }

      memoryNotes.delete(id);
      return response.status(200).json({ id, deleted: true });
    }
  } catch {
    return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

