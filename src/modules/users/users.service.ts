import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import bcrypt from 'bcrypt'
import {
  getUserByEmail,
  getUserById,
  getUserByIdWithPassword,
  revokeAllUserRefreshTokens,
  updateUserPassword,
  updateUserProfile,
} from '../../generated/prisma/sql'
import { PrismaService } from '../../prisma/prisma.service'
import type { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class UserService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private toNumber(value: bigint): number {
    return Number(value)
  }

  private toUserResponse(row: { id: bigint; email: string; name: string; created_at: Date }) {
    return {
      id: this.toNumber(row.id),
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
    }
  }

  async getProfile(userId: number) {
    const users = await this.prisma.$queryRawTyped(getUserById(userId))
    const user = users[0]
    if (!user) {
      throw new NotFoundException({ code: 'not_found', message: 'User not found' })
    }
    return this.toUserResponse(user)
  }

  async updateProfile(authUserId: number, targetUserId: number, dto: UpdateUserDto) {
    if (authUserId !== targetUserId) {
      throw new ForbiddenException({
        code: 'forbidden',
        message: 'You can only update your own profile',
      })
    }

    const users = await this.prisma.$queryRawTyped(getUserByIdWithPassword(authUserId))
    const currentUser = users[0]
    if (!currentUser) {
      throw new NotFoundException({ code: 'not_found', message: 'User not found' })
    }

    if (dto.password) {
      const isOldPasswordValid = await bcrypt.compare(
        dto.currentPassword || '',
        currentUser.password,
      )
      if (!isOldPasswordValid) {
        throw new UnauthorizedException({
          code: 'auth.password.wrong_current',
          message: 'Current password is incorrect',
        })
      }

      const hashedNewPassword = await bcrypt.hash(dto.password, 10)
      await this.prisma.$queryRawTyped(updateUserPassword(authUserId, hashedNewPassword))
      await this.prisma.$queryRawTyped(revokeAllUserRefreshTokens(authUserId))
    }

    if (dto.email && dto.email !== currentUser.email) {
      const existing = await this.prisma.$queryRawTyped(getUserByEmail(dto.email))
      if (existing[0]) {
        throw new ConflictException({
          code: 'auth.user.exists',
          message: 'Email already registered',
        })
      }
    }

    const finalName = dto.name !== undefined ? dto.name : currentUser.name
    const finalEmail = dto.email !== undefined ? dto.email : currentUser.email

    const updatedUsers = await this.prisma.$queryRawTyped(
      updateUserProfile(authUserId, finalName, finalEmail),
    )

    if (!updatedUsers[0]) {
      throw new NotFoundException({
        code: 'user.not_found',
        message: 'User not found',
      })
    }

    return this.toUserResponse(updatedUsers[0])
  }
}
