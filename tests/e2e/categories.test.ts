import { describe, expect, it } from 'vitest'
import { server } from './db'
import { authedReq, request, seedCategory, seedTransaction, seedUser, uniq } from './helpers'

describe('POST /categories', () => {
  it('returns 401 without auth', async () => {
    const res = await request(server()).post('/categories').send({ name: 'Food', type: 'expense' })
    expect(res.status).toBe(401)
  })

  it('returns 201 valid', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken)
      .post('/categories')
      .send({ name: uniq('food'), type: 'expense' })

    expect(res.status).toBe(201)
    expect(res.body.data.category).toMatchObject({ name: expect.any(String), type: 'expense' })
  })

  it('returns 201 name with special characters', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken)
      .post('/categories')
      .send({ name: 'Food & Drinks', type: 'expense' })

    expect(res.status).toBe(201)
    expect(res.body.data.category.name).toBe('Food & Drinks')
  })

  it('returns 400 missing name', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).post('/categories').send({ type: 'expense' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 empty name', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).post('/categories').send({ name: '', type: 'expense' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 missing type', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken)
      .post('/categories')
      .send({ name: uniq('cat') })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 invalid type', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken)
      .post('/categories')
      .send({ name: uniq('cat'), type: 'saving' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 409 duplicate name per user', async () => {
    const { accessToken } = await seedUser()
    const name = uniq('cat')
    await seedCategory(accessToken, { name })
    const res = await authedReq(accessToken).post('/categories').send({ name, type: 'expense' })

    expect(res.status).toBe(409)
  })

  it('returns 201 same name different user', async () => {
    const { accessToken: token1 } = await seedUser({ email: `${uniq('a')}@b.com` })
    const { accessToken: token2 } = await seedUser({ email: `${uniq('b')}@b.com` })
    const name = uniq('cat')
    await seedCategory(token1, { name })
    const res = await authedReq(token2).post('/categories').send({ name, type: 'expense' })

    expect(res.status).toBe(201)
  })
})

describe('GET /categories', () => {
  it('returns 200 user categories only', async () => {
    const { accessToken: token1 } = await seedUser({ email: `${uniq('a')}@b.com` })
    const { accessToken: token2 } = await seedUser({ email: `${uniq('b')}@b.com` })
    await seedCategory(token1, { name: uniq('cat') })
    await seedCategory(token2, { name: uniq('cat') })

    const res = await authedReq(token1).get('/categories')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('returns 200 filter by type', async () => {
    const { accessToken } = await seedUser()
    await seedCategory(accessToken, { name: uniq('income'), type: 'income' })
    await seedCategory(accessToken, { name: uniq('expense'), type: 'expense' })

    const res = await authedReq(accessToken).get('/categories?type=income')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].type).toBe('income')
  })

  it('returns 200 empty array when no categories', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).get('/categories')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

describe('PATCH /categories/:id', () => {
  it('returns 200 own name changed', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .patch(`/categories/${cat.id}`)
      .send({ name: 'New Name' })

    expect(res.status).toBe(200)
    expect(res.body.data.category.name).toBe('New Name')
  })

  it('returns 200 own type changed', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken, { type: 'expense' })
    const res = await authedReq(accessToken).patch(`/categories/${cat.id}`).send({ type: 'income' })

    expect(res.status).toBe(200)
    expect(res.body.data.category.type).toBe('income')
  })

  it('returns 403 other user', async () => {
    const { accessToken: ownerToken } = await seedUser({ email: `${uniq('owner')}@b.com` })
    const { accessToken: otherToken } = await seedUser({ email: `${uniq('other')}@b.com` })
    const cat = await seedCategory(ownerToken)

    const res = await authedReq(otherToken).patch(`/categories/${cat.id}`).send({ name: 'Hacked' })
    expect(res.status).toBe(403)
  })

  it('returns 404 missing id', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).patch('/categories/99999').send({ name: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /categories/:id', () => {
  it('returns 204 own', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken).delete(`/categories/${cat.id}`)
    expect(res.status).toBe(204)
  })

  it('returns 403 other user', async () => {
    const { accessToken: ownerToken } = await seedUser({ email: `${uniq('owner')}@b.com` })
    const { accessToken: otherToken } = await seedUser({ email: `${uniq('other')}@b.com` })
    const cat = await seedCategory(ownerToken)

    const res = await authedReq(otherToken).delete(`/categories/${cat.id}`)
    expect(res.status).toBe(403)
  })

  it('returns 409 has transactions', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { categoryId: cat.id })

    const res = await authedReq(accessToken).delete(`/categories/${cat.id}`)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('category.in_use')
  })

  it('GET without auth → 401', async () => {
    const res = await request(server()).get('/categories')
    expect(res.status).toBe(401)
  })

  it('unicode name (Makanan 🍜) → 201', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken)
      .post('/categories')
      .send({ name: 'Makanan 🍜', type: 'expense' })

    expect(res.status).toBe(201)
    expect(res.body.data.category.name).toBe('Makanan 🍜')
  })

  it('delete → create same name → 201', async () => {
    const { accessToken } = await seedUser()
    const name = uniq('cat')
    const cat = await seedCategory(accessToken, { name })
    await authedReq(accessToken).delete(`/categories/${cat.id}`)

    const res = await authedReq(accessToken).post('/categories').send({ name, type: 'expense' })
    expect(res.status).toBe(201)
  })

  it('PATCH without auth → 401', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await request(server()).patch(`/categories/${cat.id}`).send({ name: 'X' })
    expect(res.status).toBe(401)
  })
})
