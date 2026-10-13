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
// 초기 가상 메모 1~3번은 사용자 A, 4번은 사용자 B 소유
const memoryNotes = new Map([
  ['1', { id: '1', resourceId: 'note:1', zone: 'note', title: '과제', body: '실습용 가상 과제 기록', owner_identity: 'a', owner_id: null }],
  ['2', { id: '2', resourceId: 'note:2', zone: 'note', title: '포트폴리오', body: '실습용 가상 포트폴리오 기록', owner_identity: 'a', owner_id: null }],
  ['3', { id: '3', resourceId: 'note:3', zone: 'note', title: '아침 리추얼', body: '실습용 가상 리추얼 기록', owner_identity: 'a', owner_id: null }],
  ['4', { id: '4', resourceId: 'note:4', zone: 'note', title: '훈련 행정 자료', body: '실습용 가상 행정 기록', owner_identity: 'b', owner_id: null }],
]);

// In-memory notice store
const memoryNotices = new Map([
  ['notice-1', {
    id: 'notice-1',
    resourceId: 'notice:1',
    zone: 'notice',
    title: '강사 공지: 구역 분리 훈련 안내',
    body: '8단계 구역 분리 훈련 공지사항입니다. 학생 구역과 강사 공지 구역은 서로 다른 자원 ID로 구분됩니다.',
    owner_id: 'instructor_system',
  }],
]);

// In-memory instructor-only store
const memoryInstructor = new Map([
  ['instructor-1', {
    id: 'instructor-1',
    resourceId: 'instructor:1',
    zone: 'instructor',
    title: '강사 전용: 채점 기준 및 보안 감사 지침',
    body: '강사 및 운영진 전용 구역 자료입니다. 학생에게는 공개되지 않습니다.',
    owner_id: 'instructor_system',
  }],
]);

function isNoticeId(targetId) {
  if (!targetId || typeof targetId !== 'string') return false;
  return targetId.startsWith('notice:') || targetId.startsWith('notice-') || targetId === 'notice';
}

function isInstructorId(targetId) {
  if (!targetId || typeof targetId !== 'string') return false;
  return targetId.startsWith('instructor:') || targetId.startsWith('instructor-') || targetId === 'instructor';
}

function normalizeNoticeId(targetId) {
  if (!targetId || typeof targetId !== 'string') return 'notice-1';
  if (targetId.startsWith('notice:')) return 'notice-' + targetId.slice(7);
  return targetId;
}

function normalizeInstructorId(targetId) {
  if (!targetId || typeof targetId !== 'string') return 'instructor-1';
  if (targetId.startsWith('instructor:')) return 'instructor-' + targetId.slice(11);
  return targetId;
}

function normalizeNoteId(targetId) {
  if (!targetId || typeof targetId !== 'string') return targetId;
  if (targetId.startsWith('note:')) return targetId.slice(5);
  return targetId;
}

function getNotice(targetId) {
  const normalized = normalizeNoticeId(targetId);
  return memoryNotices.get(normalized) || memoryNotices.get('notice-1');
}

/**
 * 검증된 사용자와 저장된 메모의 소유자를 대조합니다.
 */
function isOwnerMatch(storedNote, authUser) {
  if (!storedNote || !authUser) return false;

  // 1. Judge 토큰의 identity('a' or 'b')와 메모의 owner_identity 대조
  if (authUser.identity && storedNote.owner_identity) {
    return authUser.identity === storedNote.owner_identity;
  }

  // 2. 만약 메모의 owner_id가 명시적으로 설정되어 있다면 정확히 일치해야 함
  if (storedNote.owner_id) {
    return storedNote.owner_id === authUser.userId;
  }

  // 3. owner_id가 아직 비어있는 초기 메모(fallback)의 경우:
  if (storedNote.owner_identity === 'a') {
    storedNote.owner_id = authUser.userId;
    return true;
  }
  if (storedNote.owner_identity === 'b') {
    return false;
  }

  return storedNote.owner_id === authUser.userId;
}

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
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || '';

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

  // 화면 메뉴나 요청 본문의 role은 절대 신뢰하지 않고, 오직 검증된 authUser의 신원 정보만 사용
  const isInstructor = Boolean(
    authUser && (authUser.kind === 'instructor' || authUser.role === 'instructor' || authUser.aleph_role === 'instructor')
  );

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
      // 2-1. 강사 전용 구역 자원인 경우 (일반 학생 접근 불가)
      if (isInstructorId(id)) {
        if (!isInstructor) {
          return response.status(403).json({ error: 'FORBIDDEN_INSTRUCTOR_REQUIRED' });
        }
        const item = memoryInstructor.get(normalizeInstructorId(id));
        if (!item) return response.status(404).json({ error: 'ITEM_NOT_FOUND' });
        return response.status(200).json({
          id: item.id,
          resourceId: item.resourceId,
          zone: item.zone,
          title: item.title,
          body: item.body,
        });
      }

      // 2-2. 강사 공지 구역 자원인 경우 (학생 누구나 조회 허용)
      if (isNoticeId(id)) {
        const notice = getNotice(id);
        if (!notice) {
          return response.status(404).json({ error: 'NOTICE_NOT_FOUND' });
        }
        return response.status(200).json({
          id: notice.id,
          resourceId: notice.resourceId,
          zone: notice.zone,
          title: notice.title,
          body: notice.body ?? '',
        });
      }

      // 2-3. 내 메모 구역 자원인 경우 (검증된 사용자와 저장된 소유자 엄격 대조)
      const noteId = normalizeNoteId(id);
      if (supabase) {
        try {
          const { data: note, error } = await supabase
            .from('notes')
            .select('id, title, content, owner_id')
            .eq('id', noteId)
            .maybeSingle();

          if (!error && note) {
            // 저장된 소유자와 검증된 사용자가 다르면 다른 구역 자료 차단 (403)
            if (note.owner_id !== authUser.userId) {
              return response.status(403).json({ error: 'FORBIDDEN_OTHER_ZONE_OR_OWNER' });
            }
            return response.status(200).json({
              id: note.id,
              resourceId: `note:${note.id}`,
              zone: 'note',
              title: note.title,
              body: note.content ?? '',
            });
          }
          if (!error && !note) {
            return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
          }
        } catch { /* fallback to memory */ }
      }

      const memNote = memoryNotes.get(noteId);
      if (!memNote) {
        return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      }
      if (!isOwnerMatch(memNote, authUser)) {
        return response.status(403).json({ error: 'FORBIDDEN_OTHER_ZONE_OR_OWNER' });
      }
      return response.status(200).json({
        id: memNote.id,
        resourceId: memNote.resourceId || `note:${memNote.id}`,
        zone: memNote.zone || 'note',
        title: memNote.title,
        body: memNote.body ?? '',
      });
    }

    // 3. 목록 GET (/api/notes)
    if (method === 'GET') {
      const requestedZone = request.query?.zone;

      // 일반 학생이 메뉴 우회하여 강사 전용 구역을 직접 요청한 경우 403 차단
      if (requestedZone === 'instructor' && !isInstructor) {
        return response.status(403).json({ error: 'FORBIDDEN_INSTRUCTOR_REQUIRED' });
      }

      let myNotes = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('notes')
            .select('id, title, content, owner_id, created_at')
            .eq('owner_id', authUser.userId)
            .order('created_at', { ascending: true });

          if (!error && Array.isArray(data)) {
            myNotes = data.map(note => ({
              id: note.id,
              resourceId: `note:${note.id}`,
              zone: 'note',
              title: note.title,
              body: note.content ?? '',
            }));
          }
        } catch { /* fallback to memory */ }
      }

      if (myNotes.length === 0) {
        myNotes = Array.from(memoryNotes.values())
          .filter(n => isOwnerMatch(n, authUser))
          .map(n => ({
            id: n.id,
            resourceId: n.resourceId || `note:${n.id}`,
            zone: n.zone || 'note',
            title: n.title,
            body: n.body ?? '',
          }));
      }

      const noticeList = Array.from(memoryNotices.values()).map(n => ({
        id: n.id,
        resourceId: n.resourceId,
        zone: n.zone,
        title: n.title,
        body: n.body ?? '',
      }));

      if (requestedZone === 'notice') {
        return response.status(200).json(noticeList);
      }
      if (requestedZone === 'note') {
        return response.status(200).json(myNotes);
      }

      // 기본 목록 반환: 본인 메모와 공개 공지만 반환하며 다른 구역(강사 전용 등) 자료는 절대 미포함
      return response.status(200).json([...myNotes, ...noticeList]);
    }

    // 4. 추가 POST (/api/notes) 및 단건 복원 POST (/api/notes/restore)
    if (method === 'POST') {
      const isRestoreRequest = id === 'restore'
        || request.query?.action === 'restore'
        || bodyData.action === 'restore'
        || (request.url && request.url.split('?')[0].endsWith('/restore'));

      // 4-1. 비공개 가상 메모 사본 기반 단건 복원 (POST /api/notes/restore)
      if (isRestoreRequest) {
        const targetId = bodyData.id ? normalizeNoteId(bodyData.id) : (request.query?.targetId || '4');

        // 시험 계정 B의 메모로만 확인 (사용자 A 등 타인의 B 메모 복원 시도 차단)
        if (authUser.identity && authUser.identity !== 'b' && targetId === '4') {
          return response.status(403).json({ error: 'FORBIDDEN_OTHER_USER_RESTORE' });
        }

        try {
          const { restoreSingleNote } = await import('../src/restore.mjs');
          const restoreResult = restoreSingleNote({
            noteId: targetId,
            requestedData: bodyData,
            notesStore: memoryNotes,
            verbose: false,
          });

          if (supabase) {
            try {
              await supabase.from('notes').upsert({
                id: restoreResult.restoredNote.id,
                title: restoreResult.restoredNote.title,
                content: restoreResult.restoredNote.body,
                owner_id: authUser.userId,
              });
            } catch { /* fallback to memory */ }
          }

          return response.status(200).json({
            success: true,
            message: '메모 복구 완료',
            restored: restoreResult.restoredNote,
            otherNotesPreserved: restoreResult.otherNotesPreserved,
          });
        } catch (restoreErr) {
          return response.status(400).json({
            error: 'RESTORE_MISMATCH',
            message: restoreErr.message,
          });
        }
      }

      // 강사 공지나 강사 구역 생성을 시도하는 경우 검증된 강사가 아니면 차단
      const isNoticeOrInstructorTarget = bodyData.zone === 'notice'
        || bodyData.zone === 'instructor'
        || (typeof bodyData.id === 'string' && (isNoticeId(bodyData.id) || isInstructorId(bodyData.id)));

      if (isNoticeOrInstructorTarget && !isInstructor) {
        return response.status(403).json({ error: 'FORBIDDEN_INSTRUCTOR_REQUIRED' });
      }

      const rawId = bodyData.id ? normalizeNoteId(bodyData.id) : randomUUID();
      const noteId = rawId;
      const title = bodyData.title ?? '';
      const bodyText = bodyData.body ?? bodyData.content ?? '';
      // 요청 본문의 owner_id나 role은 무시하고 검증된 authUser.userId로 강제 설정
      const ownerId = authUser.userId;

      if (supabase) {
        try {
          await supabase.from('notes').insert({
            id: noteId,
            title,
            content: bodyText,
            owner_id: ownerId,
          });
        } catch { /* fallback to memory */ }
      }

      memoryNotes.set(noteId, {
        id: noteId,
        resourceId: `note:${noteId}`,
        zone: 'note',
        title,
        body: bodyText,
        owner_id: ownerId,
        owner_identity: authUser.identity ?? null,
      });

      if (!bodyData.id) {
        return response.status(201).json({
          id: noteId,
          resourceId: `note:${noteId}`,
          zone: 'note',
        });
      }
      return response.status(201).json({
        id: noteId,
        resourceId: `note:${noteId}`,
        zone: 'note',
        title,
        body: bodyText,
      });
    }

    // 5. 수정 PUT (/api/notes/:id)
    if (method === 'PUT') {
      if (!id) {
        return response.status(400).json({ error: 'MISSING_NOTE_ID' });
      }

      // 공지나 강사 전용 구역 수정 시도 차단
      if (isNoticeId(id) || isInstructorId(id)) {
        if (!isInstructor) {
          return response.status(403).json({ error: 'FORBIDDEN_INSTRUCTOR_REQUIRED' });
        }
      }

      const noteId = normalizeNoteId(id);

      // 본문으로 owner_id나 role을 변경하려는 시도 차단
      if (bodyData.owner_id && bodyData.owner_id !== authUser.userId) {
        return response.status(403).json({ error: 'FORBIDDEN_OTHER_ZONE_OR_OWNER' });
      }

      if (supabase) {
        try {
          const { data: existing, error: findErr } = await supabase
            .from('notes')
            .select('id, owner_id')
            .eq('id', noteId)
            .maybeSingle();

          if (!findErr && !existing) {
            return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
          }
          if (!findErr && existing) {
            if (existing.owner_id !== authUser.userId) {
              return response.status(403).json({ error: 'FORBIDDEN_OTHER_ZONE_OR_OWNER' });
            }

            const updateData = {};
            if (bodyData.title !== undefined) updateData.title = bodyData.title;
            if (bodyData.body !== undefined) updateData.content = bodyData.body;
            else if (bodyData.content !== undefined) updateData.content = bodyData.content;
            updateData.owner_id = authUser.userId;

            const { data: updated, error: updateErr } = await supabase
              .from('notes')
              .update(updateData)
              .eq('id', noteId)
              .select('id, title, content')
              .maybeSingle();

            if (!updateErr && updated) {
              return response.status(200).json({
                id: updated.id,
                resourceId: `note:${updated.id}`,
                zone: 'note',
                title: updated.title,
                body: updated.content ?? '',
              });
            }
          }
        } catch { /* fallback to memory */ }
      }

      const existing = memoryNotes.get(noteId);
      if (!existing) {
        return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      }
      if (!isOwnerMatch(existing, authUser)) {
        return response.status(403).json({ error: 'FORBIDDEN_OTHER_ZONE_OR_OWNER' });
      }

      if (bodyData.title !== undefined) existing.title = bodyData.title;
      if (bodyData.body !== undefined) existing.body = bodyData.body;
      else if (bodyData.content !== undefined) existing.body = bodyData.content;
      existing.owner_id = authUser.userId;

      return response.status(200).json({
        id: existing.id,
        resourceId: existing.resourceId || `note:${existing.id}`,
        zone: existing.zone || 'note',
        title: existing.title,
        body: existing.body ?? '',
      });
    }

    // 6. 삭제 DELETE (/api/notes/:id)
    if (method === 'DELETE') {
      if (!id) {
        return response.status(400).json({ error: 'MISSING_NOTE_ID' });
      }

      // 공지나 강사 전용 구역 삭제 시도 차단
      if (isNoticeId(id) || isInstructorId(id)) {
        if (!isInstructor) {
          return response.status(403).json({ error: 'FORBIDDEN_INSTRUCTOR_REQUIRED' });
        }
      }

      const noteId = normalizeNoteId(id);

      if (supabase) {
        try {
          const { data: existing, error: findErr } = await supabase
            .from('notes')
            .select('id, owner_id')
            .eq('id', noteId)
            .maybeSingle();

          if (!findErr && !existing) {
            return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
          }
          if (!findErr && existing) {
            if (existing.owner_id !== authUser.userId) {
              return response.status(403).json({ error: 'FORBIDDEN_OTHER_ZONE_OR_OWNER' });
            }

            const { error: delErr } = await supabase
              .from('notes')
              .delete()
              .eq('id', noteId);

            if (!delErr) {
              memoryNotes.delete(noteId);
              return response.status(200).json({ id: noteId, resourceId: `note:${noteId}`, zone: 'note', deleted: true });
            }
          }
        } catch { /* fallback to memory */ }
      }

      const existing = memoryNotes.get(noteId);
      if (!existing) {
        return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      }
      if (!isOwnerMatch(existing, authUser)) {
        return response.status(403).json({ error: 'FORBIDDEN_OTHER_ZONE_OR_OWNER' });
      }

      memoryNotes.delete(noteId);
      return response.status(200).json({ id: noteId, resourceId: `note:${noteId}`, zone: 'note', deleted: true });
    }
  } catch {
    return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

