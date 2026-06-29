import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { server } from './db'
import { authedReq, seedCategory, seedTransaction, seedUser, uniq } from './helpers'

describe('GET /transactions/summary', () => {
  it('returns 401 without auth', async () => {
    const res = await request(server()).get('/transactions/summary')
    expect(res.status).toBe(401)
  })

  it('returns 200 empty summary', async () => {
    const { accessToken } = await seedUser()
    const res = await authedReq(accessToken).get('/transactions/summary')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      totalIncome: expect.any(String),
      totalExpense: expect.any(String),
      balance: expect.any(String),
      byCategory: expect.any(Array),
    })
  })

  it('aggregates by category', async () => {
    const { accessToken } = await seedUser()
    const cat1 = await seedCategory(accessToken, { name: uniq('c1'), type: 'expense' })
    const cat2 = await seedCategory(accessToken, { name: uniq('c2'), type: 'expense' })
    await seedTransaction(accessToken, { amount: '10000', categoryId: cat1.id })
    await seedTransaction(accessToken, { amount: '20000', categoryId: cat2.id })

    const res = await authedReq(accessToken).get('/transactions/summary')
    expect(res.body.data.byCategory).toHaveLength(2)
  })

  it('totalIncome, totalExpense, balance correct', async () => {
    const { accessToken } = await seedUser()
    const incCat = await seedCategory(accessToken, { name: uniq('inc'), type: 'income' })
    const expCat = await seedCategory(accessToken, { name: uniq('exp'), type: 'expense' })
    await seedTransaction(accessToken, { amount: '100000', type: 'income', categoryId: incCat.id })
    await seedTransaction(accessToken, { amount: '30000', type: 'expense', categoryId: expCat.id })

    const res = await authedReq(accessToken).get('/transactions/summary')
    expect(res.body.data.totalIncome).toBe('100000')
    expect(res.body.data.totalExpense).toBe('30000')
    expect(res.body.data.balance).toBe('70000')
  })

  it('filter by date range', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { amount: '50000', categoryId: cat.id, date: '2025-01-01' })
    await seedTransaction(accessToken, { amount: '50000', categoryId: cat.id, date: '2025-06-01' })

    const res = await authedReq(accessToken).get(
      '/transactions/summary?from=2025-03-01&to=2025-12-31',
    )
    expect(Number(res.body.data.totalExpense)).toBe(50000)
  })

  it('date range excludes transactions outside', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { amount: '10000', categoryId: cat.id, date: '2024-01-01' })
    await seedTransaction(accessToken, { amount: '20000', categoryId: cat.id, date: '2025-06-01' })

    const res = await authedReq(accessToken).get(
      '/transactions/summary?from=2025-01-01&to=2025-12-31',
    )
    expect(Number(res.body.data.totalExpense)).toBe(20000)
  })

  it('only own transactions', async () => {
    const { accessToken: tokenA } = await seedUser({ email: `${uniq('a')}@b.com` })
    const { accessToken: tokenB } = await seedUser({ email: `${uniq('b')}@b.com` })
    const catA = await seedCategory(tokenA)
    const catB = await seedCategory(tokenB)
    await seedTransaction(tokenA, { amount: '100000', categoryId: catA.id })
    await seedTransaction(tokenB, { amount: '200000', categoryId: catB.id })

    const resA = await authedReq(tokenA).get('/transactions/summary')
    const resB = await authedReq(tokenB).get('/transactions/summary')

    expect(Number(resA.body.data.totalExpense)).toBe(100000)
    expect(Number(resB.body.data.totalExpense)).toBe(200000)
  })

  it('single transaction', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken, { type: 'income' })
    await seedTransaction(accessToken, { amount: '75000', type: 'income', categoryId: cat.id })

    const res = await authedReq(accessToken).get('/transactions/summary')
    expect(res.body.data.totalIncome).toBe('75000')
    expect(res.body.data.totalExpense).toBe('0')
    expect(res.body.data.balance).toBe('75000')
  })

  it('multiple transactions same category summed correctly', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { amount: '10000', categoryId: cat.id })
    await seedTransaction(accessToken, { amount: '20000', categoryId: cat.id })
    await seedTransaction(accessToken, { amount: '30000', categoryId: cat.id })

    const res = await authedReq(accessToken).get('/transactions/summary')
    expect(Number(res.body.data.totalExpense)).toBe(60000)
  })

  it('only income (no expense) → balance = income', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken, { type: 'income' })
    await seedTransaction(accessToken, { amount: '500000', type: 'income', categoryId: cat.id })

    const res = await authedReq(accessToken).get('/transactions/summary')
    expect(res.body.data.totalIncome).toBe('500000')
    expect(res.body.data.totalExpense).toBe('0')
    expect(res.body.data.balance).toBe('500000')
  })

  it('only expense (no income) → balance negative', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken, { type: 'expense' })
    await seedTransaction(accessToken, { amount: '200000', type: 'expense', categoryId: cat.id })

    const res = await authedReq(accessToken).get('/transactions/summary')
    expect(res.body.data.totalIncome).toBe('0')
    expect(res.body.data.totalExpense).toBe('200000')
    expect(Number(res.body.data.balance)).toBe(-200000)
  })

  it('large amounts (billions) → correct sum', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken, { type: 'income' })
    await seedTransaction(accessToken, { amount: '1000000000', type: 'income', categoryId: cat.id })
    await seedTransaction(accessToken, { amount: '2000000000', type: 'income', categoryId: cat.id })

    const res = await authedReq(accessToken).get('/transactions/summary')
    expect(res.body.data.totalIncome).toBe('3000000000')
  })

  it('from > to → empty totals (not error)', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { amount: '50000', categoryId: cat.id, date: '2025-06-01' })

    const res = await authedReq(accessToken).get(
      '/transactions/summary?from=2025-12-31&to=2025-01-01',
    )
    expect(res.status).toBe(200)
    expect(Number(res.body.data.totalExpense)).toBe(0)
  })

  it('from = to → single day summary', async () => {
    const { accessToken } = await seedUser()
    const cat = await seedCategory(accessToken)
    await seedTransaction(accessToken, { amount: '30000', categoryId: cat.id, date: '2025-06-15' })
    await seedTransaction(accessToken, { amount: '70000', categoryId: cat.id, date: '2025-06-15' })
    await seedTransaction(accessToken, { amount: '50000', categoryId: cat.id, date: '2025-06-16' })

    const res = await authedReq(accessToken).get(
      '/transactions/summary?from=2025-06-15&to=2025-06-15',
    )
    expect(Number(res.body.data.totalExpense)).toBe(100000)
  })
})
