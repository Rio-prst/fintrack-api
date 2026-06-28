import { describe, expect, it } from 'vitest'
import { server } from './db'
import { authedReq, request, seedUser, uniq } from './helpers'

describe('GET /users/:id', () => {
  it('returns 200 public user (no password)', async () => {
    const { user } = await seedUser({ email: `${uniq('a')}@b.com`, name: 'Alice' })
    const res = await request(server()).get(`/users/${user.id}`)

    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ id: user.id, email: `${user.email}`, name: 'Alice' })
    expect(res.body.data.user).not.toHaveProperty('password')
  })

  it('returns 404 missing user', async () => {
    const res = await request(server()).get('/users/99999')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('not_found')
  })

  it('returns 400 non-numeric id', async () => {
    const res = await request(server()).get('/users/abc')
    expect(res.status).toBe(400)
  })

  it('returns 400 negative id', async () => {
    const res = await request(server()).get('/users/-1')
    expect(res.status).toBe(400)
  })

  it('returns 400 zero id', async () => {
    const res = await request(server()).get('/users/0')
    expect(res.status).toBe(400)
  })
})

describe('PATCH /users/:id', () => {
  it('returns 200 self update name', async () => {
    const { user, accessToken } = await seedUser({ name: 'Alice' })
    const res = await authedReq(accessToken).patch(`/users/${user.id}`).send({ name: 'Alicia' })

    expect(res.status).toBe(200)
    expect(res.body.data.user.name).toBe('Alicia')
  })

  it('returns 200 self update email', async () => {
    const { user, accessToken } = await seedUser()
    const newEmail = `${uniq('new')}@b.com`
    const res = await authedReq(accessToken).patch(`/users/${user.id}`).send({ email: newEmail })

    expect(res.status).toBe(200)
    expect(res.body.data.user.email).toBe(newEmail)
  })

  it('returns 403 other user', async () => {
    const { user: me } = await seedUser({ email: `${uniq('me')}@b.com` })
    const { accessToken: otherToken } = await seedUser({ email: `${uniq('other')}@b.com` })

    const res = await authedReq(otherToken).patch(`/users/${me.id}`).send({ name: 'Hacked' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('forbidden')
  })

  it('returns 409 email conflict', async () => {
    const { user: me, accessToken } = await seedUser({ email: `${uniq('me')}@b.com` })
    const takenEmail = `${uniq('taken')}@b.com`
    await seedUser({ email: takenEmail })

    const res = await authedReq(accessToken).patch(`/users/${me.id}`).send({ email: takenEmail })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('auth.user.exists')
  })

  it('returns 400 no currentPassword when changing password', async () => {
    const { user, accessToken } = await seedUser()
    const res = await authedReq(accessToken)
      .patch(`/users/${user.id}`)
      .send({ password: 'newpass99' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('validation.failed')
  })

  it('returns 401 wrong currentPassword', async () => {
    const { user, accessToken } = await seedUser({ password: 'oldpass99' })
    const res = await authedReq(accessToken)
      .patch(`/users/${user.id}`)
      .send({ password: 'newpass99', currentPassword: 'wrong-old' })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('auth.password.wrong_current')
  })

  it('returns 200 correct currentPassword + login with new password works', async () => {
    const { user, accessToken } = await seedUser({ password: 'oldpass99' })
    const res = await authedReq(accessToken)
      .patch(`/users/${user.id}`)
      .send({ password: 'newpass99', currentPassword: 'oldpass99' })

    expect(res.status).toBe(200)

    const loginRes = await request(server())
      .post('/auth/login')
      .send({ email: user.email, password: 'newpass99' })

    expect(loginRes.status).toBe(200)
  })

  it('returns 200 update name to empty string', async () => {
    const { user, accessToken } = await seedUser({ name: 'Alice' })
    const res = await authedReq(accessToken).patch(`/users/${user.id}`).send({ name: '' })

    expect(res.status).toBe(200)
    expect(res.body.data.user.name).toBe('')
  })
})
