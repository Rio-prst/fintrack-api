import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  countTransactions,
  createTransaction,
  deleteTransaction,
  getCategoryById,
  getTransactionById,
  getTransactions,
  updateTransaction,
} from '../../generated/prisma/sql'
import { PrismaService } from '../../prisma/prisma.service'
import type { CreateTransactionDto } from './dto/create-transaction.dto'
import type { QueryTransactionDto } from './dto/query-transaction.dto'
import type { UpdateTransactionDto } from './dto/update-transaction.dto'

@Injectable()
export class TransactionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private toNumber(value: bigint): number {
    return Number(value)
  }

  private toTransactionResponse(row: {
    id: bigint
    user_id: bigint
    category_id: bigint
    amount: string | null
    type: string
    date: Date
    description: string | null
    created_at: Date
  }) {
    return {
      id: this.toNumber(row.id),
      userId: this.toNumber(row.user_id),
      categoryId: this.toNumber(row.category_id),
      amount: (row.amount ?? '').replace(/\.00$/, ''),
      type: row.type,
      date: row.date.toISOString().split('T')[0],
      description: row.description ?? '',
      createdAt: row.created_at,
    }
  }

  async create(userId: number, dto: CreateTransactionDto) {
    const categories = await this.prisma.$queryRawTyped(getCategoryById(dto.categoryId))
    const category = categories[0]
    if (!category) {
      throw new NotFoundException({ code: 'category.not_found', message: 'Category not found' })
    }
    if (this.toNumber(category.user_id) !== userId) {
      throw new ForbiddenException({
        code: 'forbidden',
        message: 'Category does not belong to you',
      })
    }

    const created = await this.prisma.$queryRawTyped(
      createTransaction(
        userId,
        dto.categoryId,
        Number(dto.amount),
        dto.type,
        new Date(dto.date),
        dto.description,
      ),
    )

    return this.toTransactionResponse(created[0])
  }

  async findAll(userId: number, query: QueryTransactionDto) {
    const filterType = query.type ?? ''
    const filterCategoryId = query.categoryId ?? 0

    const countResult = await this.prisma.$queryRawTyped(
      countTransactions(userId, filterType, filterCategoryId, query.from ?? '', query.to ?? ''),
    )
    const total = this.toNumber(countResult[0]?.total ?? 0n)

    const offset = (query.page - 1) * query.limit

    const rows = await this.prisma.$queryRawTyped(
      getTransactions(
        userId,
        filterType,
        filterCategoryId,
        query.from ?? '',
        query.to ?? '',
        query.limit,
        offset,
      ),
    )

    return {
      data: rows.map((row) => this.toTransactionResponse(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }

  async findOne(id: number, userId: number) {
    const rows = await this.prisma.$queryRawTyped(getTransactionById(id))
    const transaction = rows[0]
    if (!transaction) {
      throw new NotFoundException({
        code: 'transaction.not_found',
        message: 'Transaction not found',
      })
    }
    if (this.toNumber(transaction.user_id) !== userId) {
      throw new ForbiddenException({
        code: 'forbidden',
        message: 'You do not own this transaction',
      })
    }
    return this.toTransactionResponse(transaction)
  }

  async update(id: number, userId: number, dto: UpdateTransactionDto) {
    const rows = await this.prisma.$queryRawTyped(getTransactionById(id))
    const existing = rows[0]
    if (!existing) {
      throw new NotFoundException({
        code: 'transaction.not_found',
        message: 'Transaction not found',
      })
    }
    if (this.toNumber(existing.user_id) !== userId) {
      throw new ForbiddenException({
        code: 'forbidden',
        message: 'You do not own this transaction',
      })
    }

    const finalCategoryId = dto.categoryId ?? this.toNumber(existing.category_id)
    const finalAmount = dto.amount !== undefined ? Number(dto.amount) : Number(existing.amount)
    const finalType = dto.type ?? existing.type
    const finalDate = dto.date ? new Date(dto.date) : existing.date
    const finalDescription =
      dto.description !== undefined ? dto.description : (existing.description ?? '')

    if (dto.categoryId) {
      const categories = await this.prisma.$queryRawTyped(getCategoryById(dto.categoryId))
      const category = categories[0]
      if (!category) {
        throw new NotFoundException({ code: 'category.not_found', message: 'Category not found' })
      }
      if (this.toNumber(category.user_id) !== userId) {
        throw new ForbiddenException({
          code: 'forbidden',
          message: 'Category does not belong to you',
        })
      }
    }

    const updated = await this.prisma.$queryRawTyped(
      updateTransaction(id, finalCategoryId, finalAmount, finalType, finalDate, finalDescription),
    )

    if (!updated[0]) {
      throw new NotFoundException({
        code: 'transaction.not_found',
        message: 'Transaction not found',
      })
    }

    return this.toTransactionResponse(updated[0])
  }

  async remove(id: number, userId: number) {
    const rows = await this.prisma.$queryRawTyped(getTransactionById(id))
    const existing = rows[0]
    if (!existing) {
      throw new NotFoundException({
        code: 'transaction.not_found',
        message: 'Transaction not found',
      })
    }
    if (this.toNumber(existing.user_id) !== userId) {
      throw new ForbiddenException({
        code: 'forbidden',
        message: 'You do not own this transaction',
      })
    }

    await this.prisma.$queryRawTyped(deleteTransaction(id))
  }
}
