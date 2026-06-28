import request from 'supertest'
import { server, uniq } from './db'

export { uniq }

export async function seedUser(o: { email?: string; password?: string; name?: string } = {}) {
  const body = {
    email: o.email ?? `${uniq('u')}@test.com`,
    password: o.password ?? 'password123',
    name: o.name ?? 'Test',
  }
  const res = await request(server()).post('/auth/register').send(body)
  if (res.status !== 201) throw new Error(`seedUser ${res.status}: ${JSON.stringify(res.body)}`)
  return {
    user: res.body.data.user,
    accessToken: res.body.data.accessToken,
    refreshToken: extractRefreshToken(res),
  }
}

export async function loginUser(email: string, password: string) {
  const res = await request(server()).post('/auth/login').send({ email, password })
  if (res.status !== 200) throw new Error(`loginUser ${res.status}: ${JSON.stringify(res.body)}`)
  return {
    user: res.body.data.user,
    accessToken: res.body.data.accessToken,
    refreshToken: extractRefreshToken(res),
  }
}

export function authedReq(accessToken: string) {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const s = server()
  return {
    get: (url: string) => request(s).get(url).set(headers),
    post: (url: string) => request(s).post(url).set(headers),
    patch: (url: string) => request(s).patch(url).set(headers),
    delete: (url: string) => request(s).delete(url).set(headers),
  }
}

export async function seedCategory(
  accessToken: string,
  o: { name?: string; type?: 'income' | 'expense' } = {},
) {
  const body = { name: o.name ?? uniq('cat'), type: o.type ?? 'expense' }
  const res = await authedReq(accessToken).post('/categories').send(body)
  if (res.status !== 201) throw new Error(`seedCategory ${res.status}: ${JSON.stringify(res.body)}`)
  return res.body.data.category
}

export async function seedTransaction(
  accessToken: string,
  o: {
    amount?: string
    description?: string
    type?: 'income' | 'expense'
    categoryId?: number
    date?: string
  } = {},
) {
  const body = {
    amount: o.amount ?? '50000',
    description: o.description ?? uniq('txn'),
    type: o.type ?? 'expense',
    categoryId: o.categoryId,
    date: o.date ?? new Date().toISOString().split('T')[0],
  }
  const res = await authedReq(accessToken).post('/transactions').send(body)
  if (res.status !== 201)
    throw new Error(`seedTransaction ${res.status}: ${JSON.stringify(res.body)}`)
  return res.body.data.transaction
}

function extractRefreshToken(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  if (!setCookie) throw new Error('No Set-Cookie header')
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  const match = cookie.match(/refresh_token=([^;]+)/)
  if (!match) throw new Error('No refresh_token in cookie')
  return match[1]
}

export { request }
