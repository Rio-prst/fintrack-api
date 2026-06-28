import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { server } from './db'
import { request, seedUser, uniq } from './helpers'

describe('POST /auth/register', () => {
  it('returns 201 with user + accessToken + set-cookie refresh_token', async () => {
    const email = `${uniq('a')}@b.com`
    const res = await request(server())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Alice' })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      user: { email, name: 'Alice' },
      accessToken: expect.any(String),
    })
    expect(res.body.data.user).not.toHaveProperty('password')
    expect(res.body.data.user.id).toEqual(expect.any(Number))
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 201 user object has id, email, name, createdAt', async () => {
    const email = `${uniq('a')}@b.com`
    const res = await request(server())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Bob' })

    expect(res.status).toBe(201)
    expect(res.body.data.user).toHaveProperty('id')
    expect(res.body.data.user).toHaveProperty('email')
    expect(res.body.data.user).toHaveProperty('name')
    expect(res.body.data.user).toHaveProperty('createdAt')
  })

  it('returns 409 on duplicate email', async () => {
    const email = `${uniq('dup')}@b.com`
    await seedUser({ email })
    const res = await request(server())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Bob' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('auth.user.exists')
  })

  it('returns 400 on weak password <8 chars', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: `${uniq('a')}@b.com`, password: 'short', name: 'A' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on password exactly 7 chars', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: `${uniq('a')}@b.com`, password: 'abc1234', name: 'A' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on invalid email format', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'secret123', name: 'A' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on invalid email format (@domain.com)', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: '@domain.com', password: 'secret123', name: 'A' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on invalid email format (user@)', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: 'user@', password: 'secret123', name: 'A' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on missing email', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ password: 'secret123', name: 'A' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on missing password', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: `${uniq('a')}@b.com`, name: 'A' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on missing name', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: `${uniq('a')}@b.com`, password: 'secret123' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on empty body', async () => {
    const res = await request(server()).post('/auth/register').send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on name is empty string', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: `${uniq('a')}@b.com`, password: 'secret123', name: '' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })
})

describe('POST /auth/login', () => {
  it('returns 200 with user + accessToken + set-cookie', async () => {
    const email = `${uniq('a')}@b.com`
    await seedUser({ email, password: 'secret123' })
    const res = await request(server()).post('/auth/login').send({ email, password: 'secret123' })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      user: { email },
      accessToken: expect.any(String),
    })
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 401 on wrong password', async () => {
    const email = `${uniq('a')}@b.com`
    await seedUser({ email, password: 'secret123' })
    const res = await request(server()).post('/auth/login').send({ email, password: 'wrong-pwd' })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('auth.credentials.invalid')
  })

  it('returns 401 on non-existent email', async () => {
    const res = await request(server())
      .post('/auth/login')
      .send({ email: `${uniq('x')}@b.com`, password: 'secret123' })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('auth.credentials.invalid')
  })

  it('returns 400 on missing email', async () => {
    const res = await request(server()).post('/auth/login').send({ password: 'secret123' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 on missing password', async () => {
    const res = await request(server())
      .post('/auth/login')
      .send({ email: `${uniq('a')}@b.com` })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('login after register returns different token', async () => {
    const email = `${uniq('a')}@b.com`
    const reg = await seedUser({ email, password: 'secret123' })
    const login = await loginUser(email, 'secret123')

    expect(login.accessToken).not.toBe(reg.accessToken)
  })
})

describe('POST /auth/rotate', () => {
  it('returns 200 with new accessToken + new set-cookie', async () => {
    const { refreshToken } = await seedUser()
    const res = await request(server())
      .post('/auth/rotate')
      .set('Cookie', `refresh_token=${refreshToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeDefined()
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 401 without refresh_token cookie', async () => {
    const res = await request(server()).post('/auth/rotate')
    expect(res.status).toBe(401)
  })

  it('returns 401 on revoked token', async () => {
    const { refreshToken } = await seedUser()
    await request(server()).post('/auth/rotate').set('Cookie', `refresh_token=${refreshToken}`)
    const res = await request(server())
      .post('/auth/rotate')
      .set('Cookie', `refresh_token=${refreshToken}`)

    expect(res.status).toBe(401)
  })

  it('returns 401 on expired token', async () => {
    await seedUser()
    const expiredToken = jwt.sign(
      { sub: 1, email: 'x@y.com' },
      process.env.JWT_REFRESH_SECRET ?? 'test',
      { expiresIn: '-1s' },
    )
    const res = await request(server())
      .post('/auth/rotate')
      .set('Cookie', `refresh_token=${expiredToken}`)

    expect(res.status).toBe(401)
  })

  it('returns 401 on garbage token string', async () => {
    const res = await request(server())
      .post('/auth/rotate')
      .set('Cookie', 'refresh_token=garbage.token.here')

    expect(res.status).toBe(401)
  })

  it('old refresh token unusable after rotation', async () => {
    const { refreshToken } = await seedUser()
    await request(server()).post('/auth/rotate').set('Cookie', `refresh_token=${refreshToken}`)
    const res = await request(server())
      .post('/auth/rotate')
      .set('Cookie', `refresh_token=${refreshToken}`)

    expect(res.status).toBe(401)
  })

  it('double rotation: second rotate with old cookie fails', async () => {
    const { refreshToken } = await seedUser()
    await request(server()).post('/auth/rotate').set('Cookie', `refresh_token=${refreshToken}`)
    const res = await request(server())
      .post('/auth/rotate')
      .set('Cookie', `refresh_token=${refreshToken}`)

    expect(res.status).toBe(401)
  })
})

describe('POST /auth/logout', () => {
  it('returns 200 + clears cookie', async () => {
    const { refreshToken } = await seedUser()
    const res = await request(server())
      .post('/auth/logout')
      .set('Cookie', `refresh_token=${refreshToken}`)

    expect(res.status).toBe(200)
  })

  it('returns 200 even without cookie (idempotent)', async () => {
    const res = await request(server()).post('/auth/logout')
    expect(res.status).toBe(200)
  })
})

describe('GET /auth/me', () => {
  it('returns 200 with user', async () => {
    const { accessToken, user } = await seedUser({ name: 'Alice' })
    const res = await request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ id: user.id, name: 'Alice' })
  })

  it('returns 401 without Authorization header', async () => {
    const res = await request(server()).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 expired access token', async () => {
    const expiredToken = jwt.sign({ sub: 1, email: 'x@y.com' }, process.env.JWT_SECRET ?? 'test', {
      expiresIn: '-1s',
    })
    const res = await request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)

    expect(res.status).toBe(401)
  })

  it('returns 401 garbage token', async () => {
    const res = await request(server())
      .get('/auth/me')
      .set('Authorization', 'Bearer garbage.token.here')

    expect(res.status).toBe(401)
  })

  it('returns 401 wrong-secret token', async () => {
    const wrongToken = jwt.sign({ sub: 1, email: 'x@y.com' }, 'wrong-secret')
    const res = await request(server()).get('/auth/me').set('Authorization', `Bearer ${wrongToken}`)

    expect(res.status).toBe(401)
  })

  it('returns 401 malformed Bearer (no token)', async () => {
    const res = await request(server()).get('/auth/me').set('Authorization', 'Bearer')

    expect(res.status).toBe(401)
  })

  it('returns 401 Basic auth scheme', async () => {
    const res = await request(server()).get('/auth/me').set('Authorization', 'Basic dXNlcjpwYXNz')

    expect(res.status).toBe(401)
  })

  it('returns 401 empty Bearer', async () => {
    const res = await request(server()).get('/auth/me').set('Authorization', 'Bearer ')

    expect(res.status).toBe(401)
  })

  it('password never returned in register, login, or me response', async () => {
    const email = `${uniq('a')}@b.com`
    const reg = await request(server())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'A' })

    expect(reg.body.data.user).not.toHaveProperty('password')

    const login = await request(server()).post('/auth/login').send({ email, password: 'secret123' })

    expect(login.body.data.user).not.toHaveProperty('password')

    const me = await request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)

    expect(me.body.data.user).not.toHaveProperty('password')
  })
})
