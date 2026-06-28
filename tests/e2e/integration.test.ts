import { describe, expect, it } from 'vitest'
import { server } from './db'
import { authedReq, request, seedCategory, seedTransaction, seedUser, uniq } from './helpers'

describe('Integration flows', () => {
  it('full happy path: register → login → create categories → transactions → summary', async () => {
    const email = `${uniq('a')}@b.com`
    const reg = await request(server())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Alice' })
    expect(reg.status).toBe(201)

    const login = await request(server()).post('/auth/login').send({ email, password: 'secret123' })
    expect(login.status).toBe(200)
    const token = login.body.data.accessToken

    const incCat = await seedCategory(token, { name: uniq('salary'), type: 'income' })
    const expCat = await seedCategory(token, { name: uniq('food'), type: 'expense' })

    await seedTransaction(token, {
      amount: '5000000',
      type: 'income',
      categoryId: incCat.id,
      date: '2025-01-01',
    })
    await seedTransaction(token, {
      amount: '500000',
      type: 'expense',
      categoryId: expCat.id,
      date: '2025-01-05',
    })

    const summary = await authedReq(token).get('/transactions/summary')
    expect(summary.status).toBe(200)
    expect(summary.body.data.totalIncome).toBe('5000000')
    expect(summary.body.data.totalExpense).toBe('500000')
    expect(summary.body.data.balance).toBe('4500000')
  })

  it('cascade guard: create category → create transaction → delete category → 409', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { categoryId: cat.id })
    const res = await authedReq(accessToken).delete(`/categories/${cat.id}`)

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('category.in_use')
  })

  it('token lifecycle: register → login → rotate → rotate → old tokens dead', async () => {
    const { refreshToken } = await seedUser()
    const r1 = await request(server())
      .post('/auth/rotate')
      .set('Cookie', `refresh_token=${refreshToken}`)
    expect(r1.status).toBe(200)

    const cookie1 = r1.headers['set-cookie'][0].match(/refresh_token=([^;]+)/)?.[1]
    const r2 = await request(server())
      .post('/auth/rotate')
      .set('Cookie', `refresh_token=${cookie1}`)
    expect(r2.status).toBe(200)

    const res = await request(server())
      .post('/auth/rotate')
      .set('Cookie', `refresh_token=${refreshToken}`)
    expect(res.status).toBe(401)
  })

  it('CRUD lifecycle: create → get → update → delete → verify 404', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    const txn = await seedTransaction(accessToken, { categoryId: cat.id })

    const get = await authedReq(accessToken).get(`/transactions/${txn.id}`)
    expect(get.status).toBe(200)

    const update = await authedReq(accessToken)
      .patch(`/transactions/${txn.id}`)
      .send({ amount: '99999' })
    expect(update.status).toBe(200)
    expect(update.body.data.transaction.amount).toBe('99999')

    const del = await authedReq(accessToken).delete(`/transactions/${txn.id}`)
    expect(del.status).toBe(204)

    const gone = await authedReq(accessToken).get(`/transactions/${txn.id}`)
    expect(gone.status).toBe(404)
  })

  it("data isolation: user A creates data → user B can't see it", async () => {
    const { accessToken: tokenA } = await seedUser({ email: `${uniq('a')}@b.com` })
    const { accessToken: tokenB } = await seedUser({ email: `${uniq('b')}@b.com` })

    const catA = await seedCategory(tokenA, { name: uniq('cat') })
    await seedTransaction(tokenA, { categoryId: catA.id })

    const txnsA = await authedReq(tokenA).get('/transactions')
    const txnsB = await authedReq(tokenB).get('/transactions')

    expect(txnsA.body.data).toHaveLength(1)
    expect(txnsB.body.data).toHaveLength(0)

    const txnA = txnsA.body.data[0]
    const getAsB = await authedReq(tokenB).get(`/transactions/${txnA.id}`)
    expect(getAsB.status).toBe(403)
  })
})
