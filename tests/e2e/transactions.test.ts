import { describe, expect, it } from 'vitest'
import { server } from './db'
import { authedReq, request, seedCategory, seedTransaction, seedUser, uniq } from './helpers'

describe('POST /transactions', () => {
  it('returns 401 without auth', async () => {
    const res = await request(server()).post('/transactions').send({
      amount: '50000',
      description: 'Test',
      type: 'expense',
      categoryId: 1,
      date: '2025-01-01',
    })
    expect(res.status).toBe(401)
  })

  it('returns 201 valid income', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken, { type: 'income' })
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '50000',
        description: uniq('desc'),
        type: 'income',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(201)
    expect(res.body.data.transaction).toMatchObject({ type: 'income', amount: '50000' })
  })

  it('returns 201 valid expense', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken, { type: 'expense' })
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '25000',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(201)
    expect(res.body.data.transaction.type).toBe('expense')
  })

  it('returns 400 missing amount', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({ description: uniq('desc'), type: 'expense', categoryId: cat.id, date: '2025-01-01' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 400 amount = "0"', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '0',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 negative amount', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '-1000',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 amount = "abc"', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: 'abc',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 invalid type enum', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '50000',
        description: uniq('desc'),
        type: 'saving',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 missing categoryId', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({ amount: '50000', description: uniq('desc'), type: 'expense', date: '2025-01-01' })

    expect(res.status).toBe(400)
  })

  it('returns 404 non-existent categoryId', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '50000',
        description: uniq('desc'),
        type: 'expense',
        categoryId: 99999,
        date: '2025-01-01',
      })

    expect(res.status).toBe(404)
  })

  it('returns 400 missing date', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({ amount: '50000', description: uniq('desc'), type: 'expense', categoryId: cat.id })

    expect(res.status).toBe(400)
  })

  it('returns 400 invalid date', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '50000',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: 'not-a-date',
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 missing description', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({ amount: '50000', type: 'expense', categoryId: cat.id, date: '2025-01-01' })

    expect(res.status).toBe(400)
  })

  it('returns 400 empty description', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken).post('/transactions').send({
      amount: '50000',
      description: '',
      type: 'expense',
      categoryId: cat.id,
      date: '2025-01-01',
    })

    expect(res.status).toBe(400)
  })

  it('returns 201 amount with 2 decimals', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '15000.50',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(201)
    expect(res.body.data.transaction.amount).toBe('15000.50')
  })

  it('returns 201 amount with 0 decimals', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '50000',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(201)
  })

  it('returns 400 amount with >2 decimals', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '100.999',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(400)
  })

  it('returns 201 amount = "0.01" (minimum positive)', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '0.01',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(201)
  })

  it('returns 201 amount = "9999999999.99" (large)', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '9999999999.99',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(201)
  })

  it('returns 201 date in past', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '50000',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2020-06-15',
      })

    expect(res.status).toBe(201)
  })

  it('returns 201 date = today', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const today = new Date().toISOString().split('T')[0]
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '50000',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: today,
      })

    expect(res.status).toBe(201)
  })
})

describe('GET /transactions', () => {
  it('returns 200 paginated', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    for (let i = 0; i < 5; i++) await seedTransaction(accessToken, { categoryId: cat.id })
    const res = await authedReq(accessToken).get('/transactions?page=1&limit=2')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 5 })
  })

  it('returns 400 limit=0', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).get('/transactions?limit=0')
    expect(res.status).toBe(400)
  })

  it('returns 400 limit=101', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).get('/transactions?limit=101')
    expect(res.status).toBe(400)
  })

  it('returns 400 page=0', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).get('/transactions?page=0')
    expect(res.status).toBe(400)
  })

  it('returns 400 page=abc', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).get('/transactions?page=abc')
    expect(res.status).toBe(400)
  })

  it('filters by type', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { type: 'income', categoryId: cat.id })
    await seedTransaction(accessToken, { type: 'expense', categoryId: cat.id })
    const res = await authedReq(accessToken).get('/transactions?type=income')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].type).toBe('income')
  })

  it('filters by category', async () => {
    const { accessToken } = await seedUser()
    const cat1 = await seedCategory(accessToken, { name: uniq('c1') })
    const cat2 = await seedCategory(accessToken, { name: uniq('c2') })
    await seedTransaction(accessToken, { categoryId: cat1.id })
    await seedTransaction(accessToken, { categoryId: cat2.id })
    const res = await authedReq(accessToken).get(`/transactions?categoryId=${cat1.id}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('filters by date range', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { categoryId: cat.id, date: '2025-01-01' })
    await seedTransaction(accessToken, { categoryId: cat.id, date: '2025-06-01' })
    const res = await authedReq(accessToken).get('/transactions?from=2025-03-01&to=2025-12-31')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('from > to returns empty', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { categoryId: cat.id, date: '2025-06-01' })
    const res = await authedReq(accessToken).get('/transactions?from=2025-12-31&to=2025-01-01')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('from = to (single day)', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { categoryId: cat.id, date: '2025-06-15' })
    await seedTransaction(accessToken, { categoryId: cat.id, date: '2025-06-16' })
    const res = await authedReq(accessToken).get('/transactions?from=2025-06-15&to=2025-06-15')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('only own transactions', async () => {
    const { accessToken: tokenA } = await seedUser({ email: `${uniq('a')}@b.com` })
    const { accessToken: tokenB } = await seedUser({ email: `${uniq('b')}@b.com` })
    const catA = await seedCategory(tokenA)
    const catB = await seedCategory(tokenB)
    await seedTransaction(tokenA, { categoryId: catA.id })
    await seedTransaction(tokenB, { categoryId: catB.id })

    const resA = await authedReq(tokenA).get('/transactions')
    const resB = await authedReq(tokenB).get('/transactions')

    expect(resA.body.data).toHaveLength(1)
    expect(resB.body.data).toHaveLength(1)
    expect(resA.body.data[0].userId).not.toBe(resB.body.data[0].userId)
  })

  it('default pagination', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).get('/transactions')

    expect(res.status).toBe(200)
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 })
  })
})

describe('GET /transactions/:id', () => {
  it('returns 200 with full object', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const txn = await seedTransaction(accessToken, { categoryId: cat.id })
    const res = await authedReq(accessToken).get(`/transactions/${txn.id}`)

    expect(res.status).toBe(200)
    expect(res.body.data.transaction).toMatchObject({ id: txn.id })
  })

  it('returns 404 missing', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).get('/transactions/99999')
    expect(res.status).toBe(404)
  })

  it('returns 403 other user', async () => {
    const { accessToken: ownerToken } = await seedUser({ email: `${uniq('owner')}@b.com` })
    const { accessToken: otherToken } = await seedUser({ email: `${uniq('other')}@b.com` })
    const cat = await seedCategory(ownerToken)
    const txn = await seedTransaction(ownerToken, { categoryId: cat.id })

    const res = await authedReq(otherToken).get(`/transactions/${txn.id}`)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /transactions/:id', () => {
  it('returns 200 own amount changed', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const txn = await seedTransaction(accessToken, { categoryId: cat.id })
    const res = await authedReq(accessToken)
      .patch(`/transactions/${txn.id}`)
      .send({ amount: '99999' })

    expect(res.status).toBe(200)
    expect(res.body.data.transaction.amount).toBe('99999')
  })

  it('returns 200 own categoryId changed', async () => {
    const { accessToken } = await seedUser()
    const cat1 = await seedCategory(accessToken, { name: uniq('c1') })
    const cat2 = await seedCategory(accessToken, { name: uniq('c2') })
    const txn = await seedTransaction(accessToken, { categoryId: cat1.id })
    const res = await authedReq(accessToken)
      .patch(`/transactions/${txn.id}`)
      .send({ categoryId: cat2.id })

    expect(res.status).toBe(200)
    expect(res.body.data.transaction.categoryId).toBe(cat2.id)
  })

  it('returns 403 other user', async () => {
    const { accessToken: ownerToken } = await seedUser({ email: `${uniq('owner')}@b.com` })
    const { accessToken: otherToken } = await seedUser({ email: `${uniq('other')}@b.com` })
    const cat = await seedCategory(ownerToken)
    const txn = await seedTransaction(ownerToken, { categoryId: cat.id })

    const res = await authedReq(otherToken).patch(`/transactions/${txn.id}`).send({ amount: '1' })
    expect(res.status).toBe(403)
  })

  it('returns 404 missing', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).patch('/transactions/99999').send({ amount: '1' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /transactions/:id', () => {
  it('returns 204 own', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const txn = await seedTransaction(accessToken, { categoryId: cat.id })
    const res = await authedReq(accessToken).delete(`/transactions/${txn.id}`)
    expect(res.status).toBe(204)
  })

  it('returns 403 other user', async () => {
    const { accessToken: ownerToken } = await seedUser({ email: `${uniq('owner')}@b.com` })
    const { accessToken: otherToken } = await seedUser({ email: `${uniq('other')}@b.com` })
    const cat = await seedCategory(ownerToken)
    const txn = await seedTransaction(ownerToken, { categoryId: cat.id })

    const res = await authedReq(otherToken).delete(`/transactions/${txn.id}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 on second delete', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const txn = await seedTransaction(accessToken, { categoryId: cat.id })
    await authedReq(accessToken).delete(`/transactions/${txn.id}`)
    const res = await authedReq(accessToken).delete(`/transactions/${txn.id}`)
    expect(res.status).toBe(404)
  })

  it('deleting transaction does not affect other transactions', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const txn1 = await seedTransaction(accessToken, { categoryId: cat.id })
    await seedTransaction(accessToken, { categoryId: cat.id })
    await authedReq(accessToken).delete(`/transactions/${txn1.id}`)
    const res = await authedReq(accessToken).get('/transactions')

    expect(res.body.data).toHaveLength(1)
  })

  it('POST without auth → 401', async () => {
    const res = await request(server()).post('/transactions').send({
      amount: '50000',
      description: 'X',
      type: 'expense',
      categoryId: 1,
      date: '2025-01-01',
    })
    expect(res.status).toBe(401)
  })

  it('future date → 201', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '50000',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2099-12-31',
      })

    expect(res.status).toBe(201)
  })

  it('description 1000 chars → 201', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const longDesc = 'a'.repeat(1000)
    const res = await authedReq(accessToken).post('/transactions').send({
      amount: '50000',
      description: longDesc,
      type: 'expense',
      categoryId: cat.id,
      date: '2025-01-01',
    })

    expect(res.status).toBe(201)
    expect(res.body.data.transaction.description).toBe(longDesc)
  })

  it('amount "0.001" → 400 (>2 decimals)', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const res = await authedReq(accessToken)
      .post('/transactions')
      .send({
        amount: '0.001',
        description: uniq('desc'),
        type: 'expense',
        categoryId: cat.id,
        date: '2025-01-01',
      })

    expect(res.status).toBe(400)
  })

  it('GET without auth → 401', async () => {
    const res = await request(server()).get('/transactions')
    expect(res.status).toBe(401)
  })

  it('page beyond total → empty data', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { categoryId: cat.id })
    const res = await authedReq(accessToken).get('/transactions?page=999')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('limit=1 → single item', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { categoryId: cat.id })
    await seedTransaction(accessToken, { categoryId: cat.id })
    const res = await authedReq(accessToken).get('/transactions?limit=1')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('PATCH without auth → 401', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const txn = await seedTransaction(accessToken, { categoryId: cat.id })
    const res = await request(server()).patch(`/transactions/${txn.id}`).send({ amount: '1' })
    expect(res.status).toBe(401)
  })
})
