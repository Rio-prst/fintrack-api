import crypto from 'node:crypto'
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from '../../common/types/jwt-payload.interface'
import { isDuplicateError } from '../../common/utils/prisma-error'
import {
  createRefreshToken,
  createUser,
  getRefreshToken,
  getUserByEmail,
  getUserById,
  revokeRefreshToken,
} from '../../generated/prisma/sql'
import { PrismaService } from '../../prisma/prisma.service'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'

const JWT_SECRET = (() => {
  const val = process.env.JWT_SECRET
  if (!val) throw new Error('JWT_SECRET is required')
  return val
})()

const JWT_REFRESH_SECRET = (() => {
  const val = process.env.JWT_REFRESH_SECRET
  if (!val) throw new Error('JWT_REFRESH_SECRET is required')
  return val
})()

function decodePayload(decoded: string | jwt.JwtPayload): JwtPayload {
  if (typeof decoded === 'string') {
    throw new UnauthorizedException({
      code: 'auth.token.invalid',
      message: 'Invalid token payload',
    })
  }
  const sub = decoded.sub
  const email = decoded.email
  if (sub === undefined || email === undefined) {
    throw new UnauthorizedException({
      code: 'auth.token.invalid',
      message: 'Invalid token payload',
    })
  }
  return { sub: Number(sub), email: String(email) }
}

function toNumber(value: bigint): number {
  return Number(value)
}

function toUser(row: { id: bigint; email: string; name: string; created_at: Date }) {
  return {
    id: toNumber(row.id),
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  }
}

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.$queryRawTyped(getUserByEmail(dto.email))
    if (existing[0]) {
      throw new ConflictException({ code: 'auth.user.exists', message: 'Email already registered' })
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10)

    try {
      const created = await this.prisma.$queryRawTyped(
        createUser(dto.email, dto.name, hashedPassword),
      )
      const user = toUser(created[0])
      const tokens = await this.generateTokens(user.id, user.email)

      return { user, ...tokens }
    } catch (error: unknown) {
      if (isDuplicateError(error)) {
        throw new ConflictException({
          code: 'auth.user.exists',
          message: 'Email already registered',
        })
      }
      throw error
    }
  }

  async login(dto: LoginDto) {
    const users = await this.prisma.$queryRawTyped(getUserByEmail(dto.email))
    const row = users[0]
    if (!row) {
      throw new UnauthorizedException({
        code: 'auth.credentials.invalid',
        message: 'Invalid email or password',
      })
    }

    const valid = await bcrypt.compare(dto.password, row.password)
    if (!valid) {
      throw new UnauthorizedException({
        code: 'auth.credentials.invalid',
        message: 'Invalid email or password',
      })
    }

    const user = toUser(row)
    const tokens = await this.generateTokens(user.id, user.email)

    return { user, ...tokens }
  }

  async rotate(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException({
        code: 'auth.token.missing',
        message: 'Refresh token missing',
      })
    }

    let payload: JwtPayload
    try {
      payload = decodePayload(jwt.verify(token, JWT_REFRESH_SECRET))
    } catch {
      throw new UnauthorizedException({
        code: 'auth.token.invalid',
        message: 'Invalid or expired refresh token',
      })
    }

    const stored = await this.prisma.$queryRawTyped(getRefreshToken(token))
    if (!stored[0]) {
      throw new UnauthorizedException({
        code: 'auth.token.invalid',
        message: 'Refresh token revoked or not found',
      })
    }

    await this.prisma.$queryRawTyped(revokeRefreshToken(token))
    const tokens = await this.generateTokens(toNumber(stored[0].user_id), payload.email)

    return tokens
  }

  async logout(token: string) {
    await this.prisma.$queryRawTyped(revokeRefreshToken(token))
  }

  async getProfile(userId: number) {
    const users = await this.prisma.$queryRawTyped(getUserById(userId))
    if (!users[0]) {
      throw new UnauthorizedException({ code: 'auth.user.not_found', message: 'User not found' })
    }
    return toUser(users[0])
  }

  private async generateTokens(userId: number, email: string) {
    const accessToken = jwt.sign(
      {
        sub: userId,
        email,
        jti: crypto.randomUUID(),
      } satisfies JwtPayload & { jti: string },
      JWT_SECRET,
      { expiresIn: '15m' },
    )

    const refreshToken = jwt.sign(
      {
        sub: userId,
        email,
        jti: crypto.randomUUID(),
      } satisfies JwtPayload & { jti: string },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' },
    )

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await this.prisma.$queryRawTyped(createRefreshToken(refreshToken, userId, expiresAt))

    return { accessToken, refreshToken }
  }
}
