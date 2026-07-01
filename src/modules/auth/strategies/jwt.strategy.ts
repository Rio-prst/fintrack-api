import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { JwtPayload } from '../../../common/types/jwt-payload.interface'
import { getUserById } from '../../../generated/prisma/sql'
import { PrismaService } from '../../../prisma/prisma.service'

const JWT_SECRET = (() => {
  const val = process.env.JWT_SECRET
  if (!val) throw new Error('JWT_SECRET is required')
  return val
})()

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_SECRET,
      ignoreExpiration: false,
    })
  }

  async validate(payload: JwtPayload) {
    const users = await this.prisma.$queryRawTyped(getUserById(payload.sub))
    const user = users[0]
    if (!user) {
      throw new UnauthorizedException({ code: 'auth.user.not_found', message: 'User not found' })
    }
    return { id: Number(user.id), email: user.email, name: user.name, createdAt: user.created_at }
  }
}
