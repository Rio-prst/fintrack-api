import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { isDuplicateError } from '../../common/utils/prisma-error'
import {
  checkCategoryTransaction,
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  getCategoryByNameAndUser,
  updateCategory,
} from '../../generated/prisma/sql'
import { PrismaService } from '../../prisma/prisma.service'
import type { CreateCategoryDto } from './dto/create-category.dto'
import type { UpdateCategoryDto } from './dto/update-category.dto'

@Injectable()
export class CategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private toNumber(value: bigint): number {
    return Number(value)
  }

  private toCategoryResponse(row: {
    id: bigint
    name: string
    type: string
    user_id: bigint
    created_at: Date
  }) {
    return {
      id: this.toNumber(row.id),
      name: row.name,
      type: row.type,
      userId: this.toNumber(row.user_id),
      createdAt: row.created_at,
    }
  }

  async create(userId: number, dto: CreateCategoryDto) {
    try {
      const created = await this.prisma.$queryRawTyped(createCategory(userId, dto.name, dto.type))
      return this.toCategoryResponse(created[0])
    } catch (error) {
      if (isDuplicateError(error)) {
        throw new ConflictException({
          code: 'category.duplicate_name',
          message: `Category with name '${dto.name}' already exists`,
        })
      }
      throw error
    }
  }

  async findAll(userId: number, type?: string) {
    const filterType = type || ''
    const rows = await this.prisma.$queryRawTyped(getCategories(userId, filterType))
    return rows.map((row) => this.toCategoryResponse(row))
  }

  async update(id: number, userId: number, dto: UpdateCategoryDto) {
    const categories = await this.prisma.$queryRawTyped(getCategoryById(id))
    const currentCategory = categories[0]

    if (!currentCategory) {
      throw new NotFoundException({ code: 'category.not_found', message: 'Category not found' })
    }

    if (this.toNumber(currentCategory.user_id) !== userId) {
      throw new ForbiddenException({
        code: 'category.forbidden',
        message: 'You do not own this category',
      })
    }

    const finalName = dto.name !== undefined ? dto.name : currentCategory.name
    const finalType = dto.type !== undefined ? dto.type : currentCategory.type

    if (dto.name && dto.name !== currentCategory.name) {
      const duplicate = await this.prisma.$queryRawTyped(getCategoryByNameAndUser(userId, dto.name))
      if (duplicate[0]) {
        throw new ConflictException({
          code: 'category.duplicate_name',
          message: `Category with name '${dto.name}' already exists`,
        })
      }
    }

    const updated = await this.prisma.$queryRawTyped(updateCategory(id, finalName, finalType))

    if (!updated[0]) {
      throw new NotFoundException({
        code: 'category.not_found',
        message: 'Category not found',
      })
    }

    return this.toCategoryResponse(updated[0])
  }

  async delete(id: number, userId: number) {
    const categories = await this.prisma.$queryRawTyped(getCategoryById(id))
    const currentCategory = categories[0]

    if (!currentCategory) {
      throw new NotFoundException({ code: 'category.not_found', message: 'Category not found' })
    }

    if (this.toNumber(currentCategory.user_id) !== userId) {
      throw new ForbiddenException({
        code: 'category.forbidden',
        message: 'You do not own this category',
      })
    }

    const checkTx = await this.prisma.$queryRawTyped(checkCategoryTransaction(id))
    const totalTransactions = checkTx[0]?.total ? Number(checkTx[0].total) : 0

    if (totalTransactions > 0) {
      throw new ConflictException({
        code: 'category.in_use',
        message: 'Cannot delete category that has active transactions linked to it.',
      })
    }

    await this.prisma.$queryRawTyped(deleteCategory(id))
    return { success: true }
  }
}
