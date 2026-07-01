import { Inject, Injectable } from '@nestjs/common'
import { getSummaryByCategory, getSummaryTotals } from '../../../generated/prisma/sql'
import { PrismaService } from '../../../prisma/prisma.service'
import type { QuerySummaryDto } from './dto/query-summary.dto'

@Injectable()
export class SummaryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private toNumber(value: bigint): number {
    return Number(value)
  }

  private stripAmount(value: string | null): string {
    return (value ?? '0').replace(/\.00$/, '')
  }

  async getSummary(userId: number, query: QuerySummaryDto) {
    const from = query.from ?? ''
    const to = query.to ?? ''

    const [totalsRow] = await this.prisma.$queryRawTyped(getSummaryTotals(userId, from, to))

    const totalIncome = this.stripAmount(totalsRow?.total_income)
    const totalExpense = this.stripAmount(totalsRow?.total_expense)
    const balance = this.stripAmount(totalsRow?.balance)

    const byCategoryRows = await this.prisma.$queryRawTyped(getSummaryByCategory(userId, from, to))

    const byCategory = byCategoryRows.map((row) => ({
      categoryId: this.toNumber(row.id),
      categoryName: row.name,
      type: row.type,
      total: this.stripAmount(row.total),
    }))

    return { totalIncome, totalExpense, balance, byCategory }
  }
}
