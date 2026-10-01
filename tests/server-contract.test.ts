import { describe, expect, it, vi } from 'vitest';
import { configured, SupabaseClient, SupabaseError, type RoomSnapshot } from '../packages/server/client';

const config = { url: 'https://classroom.supabase.co', publishableKey: 'sb_publishable_browser_demo' };
const auth = { access_token: 'access-test', refresh_token: 'refresh-test', expires_in: 3600, user: { id: 'anonymous-test' } };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};
const snapshot: RoomSnapshot = { roomId: 'room-test', code: 'A1B2C3', status: 'open', expiresAt: '2026-10-02T00:00:00Z', participantCount: 3, stateVersion: 5, activity: null };

describe('Supabase transport preparation (mock HTTP, no live database)', () => {
  it('validates publishable configuration and canonicalizes the origin', async () => {
    expect(configured(config)).toBe(true);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(auth));
    const client = new SupabaseClient({ ...config, url: ` ${config.url}/ ` }, { fetch: fetcher, storage: null });
    await client.signInAnonymously();
    expect(fetcher.mock.calls[0][0]).toBe(`${config.url}/auth/v1/signup`);
  });

  it.each(['sb_secret_server_only', 'service_role', 'eyJhbGciOiJIUzI1NiJ9.legacy.signature', '', 'sb_publishable_'])('rejects privileged/legacy/missing key %s before any request', key => {
    expect(configured({ ...config, publishableKey: key })).toBe(false);
    expect(() => new SupabaseClient({ ...config, publishableKey: key })).toThrow(SupabaseError);
  });

  it.each(['http://supabase.example', 'https://user:password@supabase.example', 'https://example.org/project', 'https://example.org/?key=private', 'https://example.org/#token', 'javascript:alert(1)'])('rejects unsafe origin %s', url => {
    expect(configured({ ...config, url })).toBe(false);
  });

  it('allows explicit local Supabase HTTP origins', () => {
    expect(configured({ ...config, url: 'http://127.0.0.1:54321' })).toBe(true);
  });

  it('performs anonymous signup and sends access JWT separately from the publishable key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(auth)).mockResolvedValueOnce(json(snapshot));
    const client = new SupabaseClient(config, { fetch: fetcher, storage: null });
    expect(await client.call('wq_join_room', { p_code: 'A1B2C3' })).toEqual(snapshot);
    const signup = fetcher.mock.calls[0][1];
    expect(signup?.body).toBe('{}');
    expect(signup?.headers).not.toHaveProperty('Authorization');
    const [url, rpc] = fetcher.mock.calls[1];
    expect(url).toBe(`${config.url}/rest/v1/rpc/wq_join_room`);
    expect(rpc?.headers).toMatchObject({ apikey: config.publishableKey, Authorization: 'Bearer access-test' });
    expect(JSON.parse(String(rpc?.body))).toEqual({ p_code: 'A1B2C3' });
  });

  it('passes an optional CAPTCHA token to anonymous signup', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(auth));
    await new SupabaseClient(config, { fetch: fetcher, storage: null }).signInAnonymously('challenge-test');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ gotrue_meta_security: { captcha_token: 'challenge-test' } });
  });

  it('coalesces concurrent authentication and reuses the same participant session', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(auth));
    const client = new SupabaseClient(config, { fetch: fetcher, storage: null });
    const sessions = await Promise.all([client.signInAnonymously(), client.signInAnonymously(), client.signInAnonymously()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sessions.map(value => value.userId)).toEqual(['anonymous-test', 'anonymous-test', 'anonymous-test']);
  });

  it('restores same-tab session but never shares it with another project', async () => {
    const storage = memoryStorage(); const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(auth));
    await new SupabaseClient(config, { fetch: fetcher, storage, now: () => 1000 }).signInAnonymously();
    await new SupabaseClient(config, { fetch: fetcher, storage, now: () => 2000 }).signInAnonymously();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await new SupabaseClient({ ...config, url: 'https://other.supabase.co' }, { fetch: fetcher, storage, now: () => 2000 }).signInAnonymously();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('refreshes an expired access token once and persists the rotated refresh token', async () => {
    const storage = memoryStorage(); let now = 1000;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ...auth, expires_in: 60 }))
      .mockResolvedValueOnce(json({ ...auth, access_token: 'rotated-access', refresh_token: 'rotated-refresh' }))
      .mockResolvedValueOnce(json(snapshot));
    const client = new SupabaseClient(config, { fetch: fetcher, storage, now: () => now });
    await client.signInAnonymously(); now = 65000;
    await client.call('wq_snapshot', { p_room_id: 'room-test' });
    expect(fetcher.mock.calls[1][0]).toBe(`${config.url}/auth/v1/token?grant_type=refresh_token`);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ refresh_token: 'refresh-test' });
    expect(fetcher.mock.calls[2][1]?.headers).toMatchObject({ Authorization: 'Bearer rotated-access' });
    expect(storage.getItem(`whalequest.session:${config.url}`)).toContain('rotated-refresh');
  });

  it('does not silently replace a participant when refresh is revoked', async () => {
    const storage = memoryStorage(); let now = 0;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ...auth, expires_in: 60 })).mockResolvedValueOnce(json({ error_code: 'refresh_token_not_found' }, 400));
    const client = new SupabaseClient(config, { fetch: fetcher, storage, now: () => now });
    await client.signInAnonymously(); now = 65000;
    await expect(client.signInAnonymously()).rejects.toMatchObject({ status: 400 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(storage.getItem(`whalequest.session:${config.url}`)).toBeNull();
  });

  it('retains a session during temporary refresh network failure', async () => {
    const storage = memoryStorage(); let now = 0;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ...auth, expires_in: 60 })).mockRejectedValueOnce(new Error('offline'));
    const client = new SupabaseClient(config, { fetch: fetcher, storage, now: () => now });
    await client.signInAnonymously(); now = 65000;
    await expect(client.signInAnonymously()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(storage.getItem(`whalequest.session:${config.url}`)).toContain('refresh-test');
  });

  it('maps submission results and preserves the caller idempotency key without sending a score', async () => {
    const result = { correct: true, contribution: 1, stateVersion: 9 };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(auth)).mockResolvedValueOnce(json(result));
    const client = new SupabaseClient(config, { fetch: fetcher, storage: null });
    const body = { p_room_id: 'room-test', p_activity_id: 'activity-test', p_question_id: 'q1', p_answer: 0, p_idempotency_key: 'same-submission-test' };
    expect(await client.call('wq_submit', body)).toEqual(result);
    const sent = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(sent).toEqual(body); expect(sent).not.toHaveProperty('correct'); expect(sent).not.toHaveProperty('participantId');
  });

  it('surfaces rate limits without leaking server details and never automatically retries a mutation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(auth)).mockResolvedValueOnce(json({ code: 'P0001', message: 'secret-test SQL student answer' }, 429));
    const client = new SupabaseClient(config, { fetch: fetcher, storage: null });
    await expect(client.call('wq_create_room', {})).rejects.toMatchObject({ status: 429, code: 'P0001', message: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed successful auth responses', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ user: { id: 'test' } }));
    await expect(new SupabaseClient(config, { fetch: fetcher, storage: null }).signInAnonymously()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('rejects non-JSON responses and network errors without exposing their raw contents', async () => {
    const nonJson = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>private-test</html>', { status: 502 }));
    await expect(new SupabaseClient(config, { fetch: nonJson, storage: null }).signInAnonymously()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new Error('private-test'));
    await expect(new SupabaseClient(config, { fetch: offline, storage: null }).signInAnonymously()).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: '서버에 연결하지 못했습니다.' });
  });

  it('works with corrupt or blocked session storage', async () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(auth));
    expect((await new SupabaseClient(config, { fetch: fetcher, storage: blocked }).signInAnonymously()).userId).toBe(auth.user.id);
    const corrupt = memoryStorage(); corrupt.setItem(`whalequest.session:${config.url}`, '{bad JSON');
    await new SupabaseClient(config, { fetch: fetcher, storage: corrupt }).signInAnonymously();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown RPC names before issuing network requests', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new SupabaseClient(config, { fetch: fetcher, storage: null });
    await expect(client.call('delete_all' as 'wq_create_room', {})).rejects.toMatchObject({ code: 'INVALID_RPC' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('aborts timed-out requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    await expect(new SupabaseClient(config, { fetch: fetcher, storage: null, timeoutMs: 5 }).signInAnonymously()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
