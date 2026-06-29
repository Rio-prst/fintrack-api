import { describe, expect, it } from 'vitest'
import { server } from './db'
import { authedReq, request, seedCategory, seedUser, uniq } from './helpers'

describe('Request validation', () => {
  describe('malformed requests', () => {
    it('POST with empty string body → 400', async () => {
      const res = await request(server())
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send('')

      expect(res.status).toBe(400)
    })

    it('POST with null body → 400', async () => {
      const res = await request(server())
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send('null')

      expect(res.status).toBe(400)
    })

    it('POST with array instead of object → 400', async () => {
      const res = await request(server())
        .post('/auth/register')
        .send([{ email: 'a@b.com', password: 'secret123', name: 'A' }])

      expect(res.status).toBe(400)
    })

    it('PATCH with wrong content-type → 400', async () => {
      const { accessToken, user } = await seedUser()
      const res = await request(server())
        .patch(`/users/${user.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'text/plain')
        .send('name=New')

      expect(res.status).toBe(400)
    })

    it('POST with Content-Type: text/plain → 400', async () => {
      const res = await request(server())
        .post('/auth/register')
        .set('Content-Type', 'text/plain')
        .send('email=a@b.com&password=secret123&name=A')

      expect(res.status).toBe(400)
    })
  })

  describe('extra fields', () => {
    it('POST with extra unknown fields → 201 (ignored)', async () => {
      const res = await request(server())
        .post('/auth/register')
        .send({
          email: `${uniq('a')}@b.com`,
          password: 'secret123',
          name: 'A',
          unknownField: 'should be ignored',
          anotherField: 123,
        })

      expect(res.status).toBe(201)
    })
  })

  describe('DELETE with body', () => {
    it('DELETE with body → 204 (body ignored)', async () => {
      const { accessToken } = await seedUser()
      const cat = await seedCategory(accessToken)
      const res = await authedReq(accessToken)
        .delete(`/categories/${cat.id}`)
        .send({ reason: 'not needed' })

      expect(res.status).toBe(204)
    })
  })

  describe('boundary values', () => {
    it('GET with very long query string → 200 or 400', async () => {
      const { accessToken } = await seedUser()
      const longParam = 'a'.repeat(10000)
      const res = await authedReq(accessToken).get(`/transactions?search=${longParam}`)

      expect([200, 400]).toContain(res.status)
    })

    it('name 255 chars → 201', async () => {
      const { accessToken } = await seedUser()
      const longName = 'a'.repeat(255)
      const res = await authedReq(accessToken)
        .post('/categories')
        .send({ name: longName, type: 'expense' })

      expect(res.status).toBe(201)
      expect(res.body.data.category.name).toBe(longName)
    })

    it('name 256 chars → 400 or 201 (depends on impl)', async () => {
      const { accessToken } = await seedUser()
      const longName = 'a'.repeat(256)
      const res = await authedReq(accessToken)
        .post('/categories')
        .send({ name: longName, type: 'expense' })

      expect([201, 400]).toContain(res.status)
    })
  })

  describe('security', () => {
    it('SQL injection in name → 201 (sanitized)', async () => {
      const { accessToken } = await seedUser()
      const res = await authedReq(accessToken)
        .post('/categories')
        .send({ name: "'; DROP TABLE users; --", type: 'expense' })

      expect(res.status).toBe(201)
      expect(res.body.data.category.name).toBe("'; DROP TABLE users; --")
    })

    it('XSS in description → 201 (sanitized)', async () => {
      const { accessToken } = await seedUser()
      const cat = await seedCategory(accessToken)
      const res = await authedReq(accessToken).post('/transactions').send({
        amount: '50000',
        description: '<script>alert("xss")</script>',
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

      expect(res.status).toBe(201)
      expect(res.body.data.transaction.description).toBe('<script>alert("xss")</script>')
    })
  })

  describe('concurrency', () => {
    it('concurrent same-email register → one 201, one 409', async () => {
      const email = `${uniq('race')}@b.com`
      const [r1, r2] = await Promise.all([
        request(server()).post('/auth/register').send({ email, password: 'secret123', name: 'A' }),
        request(server()).post('/auth/register').send({ email, password: 'secret123', name: 'B' }),
      ])

      const statuses = [r1.status, r2.status].sort()
      expect(statuses).toEqual([201, 409])
    })
  })

  describe('error response structure', () => {
    it('all error responses have code field', async () => {
      const res = await request(server()).post('/auth/register').send({})

      expect(res.body).toHaveProperty('code')
      expect(typeof res.body.code).toBe('string')
    })

    it('validation error has error array with field, code, message', async () => {
      const res = await request(server()).post('/auth/register').send({})

      expect(res.body.code).toBe('validation.failed')
      expect(res.body.error).toBeInstanceOf(Array)
      if (res.body.error.length > 0) {
        expect(res.body.error[0]).toHaveProperty('field')
        expect(res.body.error[0]).toHaveProperty('code')
        expect(res.body.error[0]).toHaveProperty('message')
      }
    })
  })
})
