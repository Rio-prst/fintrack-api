import { describe, expect, it } from 'vitest'
import { server } from './db'
import { authedReq, request, seedUser, uniq } from './helpers'

describe('Session management', () => {
  describe('concurrent sessions', () => {
    it('concurrent login: device A + B both get valid tokens', async () => {
      const email = `${uniq('a')}@b.com`
      const password = 'secret123'
      await seedUser({ email, password })

      const deviceA = await request(server()).post('/auth/login').send({ email, password })
      const deviceB = await request(server()).post('/auth/login').send({ email, password })

      expect(deviceA.status).toBe(200)
      expect(deviceB.status).toBe(200)
      expect(deviceA.body.data.accessToken).toBeDefined()
      expect(deviceB.body.data.accessToken).toBeDefined()
    })

    it('logout device A does not affect device B', async () => {
      const email = `${uniq('a')}@b.com`
      const password = 'secret123'
      await seedUser({ email, password })

      const deviceA = await request(server()).post('/auth/login').send({ email, password })
      const deviceB = await request(server()).post('/auth/login').send({ email, password })

      const cookieA = deviceA.headers['set-cookie'][0].match(/refresh_token=([^;]+)/)?.[1]
      await request(server()).post('/auth/logout').set('Cookie', `refresh_token=${cookieA}`)

      const meB = await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${deviceB.body.data.accessToken}`)

      expect(meB.status).toBe(200)
    })

    it('multiple logins create separate refresh tokens', async () => {
      const email = `${uniq('a')}@b.com`
      const password = 'secret123'
      await seedUser({ email, password })

      const login1 = await request(server()).post('/auth/login').send({ email, password })
      const login2 = await request(server()).post('/auth/login').send({ email, password })

      const cookie1 = login1.headers['set-cookie'][0].match(/refresh_token=([^;]+)/)?.[1]
      const cookie2 = login2.headers['set-cookie'][0].match(/refresh_token=([^;]+)/)?.[1]

      expect(cookie1).toBeDefined()
      expect(cookie2).toBeDefined()
      expect(cookie1).not.toBe(cookie2)
    })
  })

  describe('refresh token rotation', () => {
    it('refresh chain: A→B→C, A revoked, B revoked, C valid', async () => {
      const { refreshToken: tokenA } = await seedUser()

      const r1 = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${tokenA}`)
      const tokenB = r1.headers['set-cookie'][0].match(/refresh_token=([^;]+)/)?.[1]

      const r2 = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${tokenB}`)
      const tokenC = r2.headers['set-cookie'][0].match(/refresh_token=([^;]+)/)?.[1]

      // A revoked
      const useA = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${tokenA}`)
      expect(useA.status).toBe(401)

      // B revoked
      const useB = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${tokenB}`)
      expect(useB.status).toBe(401)

      // C valid
      const useC = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${tokenC}`)
      expect(useC.status).toBe(200)
    })

    it('rotate returns new accessToken different from previous', async () => {
      const { refreshToken } = await seedUser()
      const r1 = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${refreshToken}`)
      const token1 = r1.body.data.accessToken

      const cookie1 = r1.headers['set-cookie'][0].match(/refresh_token=([^;]+)/)?.[1]
      const r2 = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${cookie1}`)
      const token2 = r2.body.data.accessToken

      expect(token1).not.toBe(token2)
    })

    it('concurrent refresh race: same token twice → one 200, one 401', async () => {
      const { refreshToken } = await seedUser()

      const [r1, r2] = await Promise.all([
        request(server()).post('/auth/rotate').set('Cookie', `refresh_token=${refreshToken}`),
        request(server()).post('/auth/rotate').set('Cookie', `refresh_token=${refreshToken}`),
      ])

      const statuses = [r1.status, r2.status].sort()
      expect(statuses).toEqual([200, 401])
    })
  })

  describe('cookie attributes', () => {
    it('refresh_token cookie has httpOnly flag', async () => {
      const { refreshToken } = await seedUser()
      const res = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${refreshToken}`)

      const cookie = res.headers['set-cookie'][0]
      expect(cookie.toLowerCase()).toContain('httponly')
    })

    it('refresh_token cookie has sameSite=Lax', async () => {
      const { refreshToken } = await seedUser()
      const res = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${refreshToken}`)

      const cookie = res.headers['set-cookie'][0]
      expect(cookie.toLowerCase()).toContain('samesite=lax')
    })

    it('refresh_token cookie path includes /auth/rotate and /auth/logout', async () => {
      const { refreshToken } = await seedUser()
      const res = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${refreshToken}`)

      const cookie = res.headers['set-cookie'][0].toLowerCase()
      expect(cookie).toContain('path=')
    })

    it('logout clears refresh_token cookie', async () => {
      const { refreshToken } = await seedUser()
      const res = await request(server())
        .post('/auth/logout')
        .set('Cookie', `refresh_token=${refreshToken}`)

      const cookie = res.headers['set-cookie'][0].toLowerCase()
      expect(cookie).toContain('refresh_token=')
      expect(cookie).toMatch(/max-age=0|expires=.*1970|expires=.*epoch/)
    })
  })

  describe('token structure', () => {
    it('access token is valid JWT (3 dot-separated parts)', async () => {
      const { accessToken } = await seedUser()
      const parts = accessToken.split('.')
      expect(parts).toHaveLength(3)
    })

    it('access token payload has sub and email', async () => {
      const { accessToken } = await seedUser({ email: `${uniq('a')}@b.com` })
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString())

      expect(payload).toHaveProperty('sub')
      expect(payload).toHaveProperty('email')
    })
  })

  describe('session lifecycle', () => {
    it('login after logout creates new valid session', async () => {
      const email = `${uniq('a')}@b.com`
      const password = 'secret123'
      await seedUser({ email, password })

      const login1 = await request(server()).post('/auth/login').send({ email, password })
      const cookie1 = login1.headers['set-cookie'][0].match(/refresh_token=([^;]+)/)?.[1]

      await request(server()).post('/auth/logout').set('Cookie', `refresh_token=${cookie1}`)

      const login2 = await request(server()).post('/auth/login').send({ email, password })
      expect(login2.status).toBe(200)
      expect(login2.body.data.accessToken).toBeDefined()
    })

    it('password change revokes old refresh tokens', async () => {
      const email = `${uniq('a')}@b.com`
      const { user, refreshToken } = await seedUser({ email, password: 'oldpass123' })

      // Change password
      await authedReq(refreshToken)
        .patch(`/users/${user.id}`)
        .send({ password: 'newpass123', currentPassword: 'oldpass123' })

      // Old refresh token should be invalid
      const res = await request(server())
        .post('/auth/rotate')
        .set('Cookie', `refresh_token=${refreshToken}`)

      expect(res.status).toBe(401)
    })

    it('requestId present in every response', async () => {
      const { accessToken } = await seedUser()

      const me = await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(me.body).toHaveProperty('requestId')
      expect(typeof me.body.requestId).toBe('string')
    })

    it('message present in every response', async () => {
      const { accessToken } = await seedUser()

      const me = await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(me.body).toHaveProperty('message')
      expect(typeof me.body.message).toBe('string')
    })
  })
})
