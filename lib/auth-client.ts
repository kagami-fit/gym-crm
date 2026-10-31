// ブラウザからのログイン・ログアウト。better-auth の API（/api/auth/...）を直接呼ぶ。
// better-auth/react を読み込まないのは、公開先（Cloudflare Workers）の容量の上限に収めるため
async function post(path: string, body: unknown = {}): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
  return { ok: res.ok, status: res.status }
}

export const signInEmail = (email: string, password: string) => post('/sign-in/email', { email, password })
export const signOut = () => post('/sign-out')
