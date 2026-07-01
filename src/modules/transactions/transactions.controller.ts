import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import type { RequestUser } from '../../common/decorators/current-user.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ApiResponse } from '../../common/interceptors/api.response'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import type { CreateTransactionDto } from './dto/create-transaction.dto'
import { CreateTransactionSchema } from './dto/create-transaction.dto'
import type { QueryTransactionDto } from './dto/query-transaction.dto'
import { QueryTransactionSchema } from './dto/query-transaction.dto'
import type { UpdateTransactionDto } from './dto/update-transaction.dto'
import { UpdateTransactionSchema } from './dto/update-transaction.dto'
import type { QuerySummaryDto } from './summary/dto/query-summary.dto'
import { QuerySummarySchema } from './summary/dto/query-summary.dto'
import { SummaryService } from './summary/summary.service'
import { TransactionsService } from './transactions.service'

@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(TransactionsService) private readonly transactionsService: TransactionsService,
    @Inject(SummaryService) private readonly summaryService: SummaryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body(new ZodValidationPipe(CreateTransactionSchema)) dto: CreateTransactionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const transaction = await this.transactionsService.create(user.id, dto)
    return new ApiResponse('Transaction created.', { transaction })
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async getSummary(
    @Query(new ZodValidationPipe(QuerySummarySchema)) query: QuerySummaryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.summaryService.getSummary(user.id, query)
    return new ApiResponse('Summary retrieved.', result)
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query(new ZodValidationPipe(QueryTransactionSchema)) query: QueryTransactionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.transactionsService.findAll(user.id, query)
    return new ApiResponse('Transactions retrieved.', result.data, result.meta)
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    const transaction = await this.transactionsService.findOne(id, user.id)
    return new ApiResponse('Transaction retrieved.', { transaction })
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateTransactionSchema)) dto: UpdateTransactionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const transaction = await this.transactionsService.update(id, user.id, dto)
    return new ApiResponse('Transaction updated.', { transaction })
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    await this.transactionsService.remove(id, user.id)
  }
}
