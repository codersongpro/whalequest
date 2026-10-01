import type { Answer, QuestionSet } from '../core/types';

/** Transport preparation only: the demo does not switch to a live backend. */
export interface SupabaseConfig { url: string; publishableKey: string }
export interface AnonymousSession { accessToken: string; refreshToken: string; expiresAt: number; userId: string }
type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface ClientOptions { fetch?: typeof fetch; storage?: SessionStorage | null; now?: () => number; timeoutMs?: number }
export interface SubmissionResult { correct: boolean | null; contribution: number; stateVersion: number }
export interface RoomSnapshot {
  roomId: string; code: string; status: 'open' | 'closed'; expiresAt: string;
  participantCount: number; stateVersion: number;
  activity: null | { id: string; kind: string; status: string; endsAt: string | null; hp: number; targetHp: number;
    questions: Array<{ id: string; type: string; prompt: string; options: string[] | null }>;
    responses: number; understanding: Record<string, number> };
}
export interface RpcContracts {
  wq_create_room: { args: Record<string, never>; result: RoomSnapshot };
  wq_join_room: { args: { p_code: string }; result: RoomSnapshot };
  wq_snapshot: { args: { p_room_id: string }; result: RoomSnapshot };
  wq_start_activity: { args: { p_room_id: string; p_kind: 'understanding' | 'quick-check' | 'assessment' | 'raid'; p_set: QuestionSet | null }; result: RoomSnapshot };
  wq_end_activity: { args: { p_room_id: string }; result: RoomSnapshot };
  wq_close_room: { args: { p_room_id: string }; result: RoomSnapshot };
  wq_submit: { args: { p_room_id: string; p_activity_id: string; p_question_id: string | null; p_answer: Answer; p_idempotency_key: string; p_duration_ms?: number }; result: SubmissionResult };
  wq_teacher_report: { args: { p_room_id: string }; result: unknown };
  wq_share_set: { args: { p_set: QuestionSet }; result: { token: string; expiresAt: string } };
  wq_read_shared_set: { args: { p_token: string }; result: QuestionSet };
  wq_send_question: { args: { p_room_id: string; p_text: string }; result: { id: string } };
  wq_read_inbox: { args: { p_room_id: string }; result: Array<{ id: string; text: string; createdAt: string }> };
}

export class SupabaseError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message); this.name = 'SupabaseError';
  }
}

function validateConfig(config: SupabaseConfig): SupabaseConfig {
  const url = new URL(config.url.trim());
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new SupabaseError('Supabase 주소는 HTTPS 원점이어야 합니다.', 0, 'INVALID_CONFIG');
  }
  const key = config.publishableKey.trim();
  // Accept only the current browser-safe key format, never legacy JWT/service-role keys.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new SupabaseError('브라우저에는 Supabase publishable 키만 사용할 수 있습니다.', 0, 'INVALID_CONFIG');
  return { url: url.origin, publishableKey: key };
}

export function configured(config: SupabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
}): boolean {
  try { validateConfig(config); return true; } catch { return false; }
}

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function readStoredSession(raw: string | null): AnonymousSession | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (isRecord(value) && typeof value.accessToken === 'string' && value.accessToken && typeof value.refreshToken === 'string' && value.refreshToken && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) && typeof value.userId === 'string' && value.userId) return value as unknown as AnonymousSession;
  } catch { /* A corrupt or inaccessible tab session must not crash the offline demo. */ }
  return null;
}

/** Sessions survive same-tab refresh, scoped by project origin, and never enter logs. */
export class SupabaseClient {
  private readonly config: SupabaseConfig;
  private readonly fetcher: typeof fetch;
  private readonly storage: SessionStorage | null;
  private readonly storageKey: string;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private session: AnonymousSession | null = null;
  private authentication: Promise<AnonymousSession> | null = null;

  constructor(config: SupabaseConfig = {
    url: import.meta.env.VITE_SUPABASE_URL ?? '', publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  }, options: ClientOptions = {}) {
    this.config = validateConfig(config); this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now; this.timeoutMs = options.timeoutMs ?? 10000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new SupabaseError('요청 제한 시간이 올바르지 않습니다.', 0, 'INVALID_CONFIG');
    this.storageKey = `whalequest.session:${this.config.url}`;
    try { this.storage = options.storage === undefined ? globalThis.sessionStorage ?? null : options.storage; }
    catch { this.storage = null; }
    try { this.session = readStoredSession(this.storage?.getItem(this.storageKey) ?? null); } catch { this.session = null; }
  }

  private saveSession(session: AnonymousSession | null): void {
    this.session = session;
    try { if (session) this.storage?.setItem(this.storageKey, JSON.stringify(session)); else this.storage?.removeItem(this.storageKey); }
    catch { /* In-memory authentication remains usable when browser storage is disabled. */ }
  }

  private async request(path: string, body: unknown, accessToken?: string): Promise<unknown> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.config.url}${path}`, {
        method: 'POST', headers: { apikey: this.config.publishableKey, 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const raw = await response.text();
      let data: unknown;
      try { data = raw ? JSON.parse(raw) : null; }
      catch { throw new SupabaseError('서버 응답 형식이 올바르지 않습니다.', response.status, 'INVALID_RESPONSE'); }
      if (!response.ok) {
        const code = isRecord(data) && typeof data.code === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(data.code) ? data.code : 'API_ERROR';
        // Raw error bodies can include SQL, student answers or credentials. Do not surface them.
        const message = response.status === 429 ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.' : response.status === 401 || response.status === 403 ? '인증 또는 수업방 권한을 확인해 주세요.' : 'Supabase 요청을 처리하지 못했습니다.';
        throw new SupabaseError(message, response.status, code);
      }
      return data;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      throw new SupabaseError(controller.signal.aborted ? '요청 시간이 초과되었습니다.' : '서버에 연결하지 못했습니다.', 0, controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
    } finally { clearTimeout(timeout); }
  }

  private async authenticate(captchaToken?: string): Promise<AnonymousSession> {
    const old = this.session;
    let value: unknown;
    try {
      value = old
        ? await this.request('/auth/v1/token?grant_type=refresh_token', { refresh_token: old.refreshToken })
        : await this.request('/auth/v1/signup', captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {});
    } catch (error) {
      if (old && error instanceof SupabaseError && [400, 401, 403].includes(error.status)) this.saveSession(null);
      throw error;
    }
    if (!isRecord(value) || typeof value.access_token !== 'string' || !value.access_token || typeof value.refresh_token !== 'string' || !value.refresh_token || typeof value.expires_in !== 'number' || !Number.isFinite(value.expires_in) || value.expires_in <= 0 || !isRecord(value.user) || typeof value.user.id !== 'string' || !value.user.id) {
      throw new SupabaseError('익명 인증 응답 형식이 올바르지 않습니다.', 0, 'INVALID_RESPONSE');
    }
    const session = { accessToken: value.access_token, refreshToken: value.refresh_token, expiresAt: this.now() + value.expires_in * 1000, userId: value.user.id };
    this.saveSession(session); return session;
  }

  async signInAnonymously(captchaToken?: string): Promise<AnonymousSession> {
    if (this.session && this.session.expiresAt > this.now() + 30000) return this.session;
    // A single refresh request prevents racing rotating refresh tokens within this client.
    if (!this.authentication) this.authentication = this.authenticate(captchaToken).finally(() => { this.authentication = null; });
    return this.authentication;
  }

  async call<Name extends keyof RpcContracts>(name: Name, body: RpcContracts[Name]['args']): Promise<RpcContracts[Name]['result']> {
    const allowed: ReadonlyArray<keyof RpcContracts> = ['wq_create_room', 'wq_join_room', 'wq_snapshot', 'wq_start_activity', 'wq_end_activity', 'wq_close_room', 'wq_submit', 'wq_teacher_report', 'wq_share_set', 'wq_read_shared_set', 'wq_send_question', 'wq_read_inbox'];
    if (!allowed.includes(name)) throw new SupabaseError('지원하지 않는 서버 명령입니다.', 0, 'INVALID_RPC');
    const session = await this.signInAnonymously();
    // Mutations are never automatically retried. Reuse the submission key on an uncertain response.
    return await this.request(`/rest/v1/rpc/${name}`, body, session.accessToken) as RpcContracts[Name]['result'];
  }
}
