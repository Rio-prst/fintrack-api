import { Module } from '@nestjs/common'
import { SummaryService } from './summary/summary.service'
import { TransactionsController } from './transactions.controller'
import { TransactionsService } from './transactions.service'

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, SummaryService],
})
export class TransactionsModule {}
