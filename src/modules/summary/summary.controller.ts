import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import type { RequestUser } from '../../common/decorators/current-user.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ApiResponse } from '../../common/interceptors/api.response'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import type { QuerySummaryDto } from './dto/query-summary.dto'
import { QuerySummarySchema } from './dto/query-summary.dto'
import { SummaryService } from './summary.service'

@Controller('transactions')
export class SummaryController {
  constructor(@Inject(SummaryService) private readonly summaryService: SummaryService) {}

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async getSummary(
    @Query(new ZodValidationPipe(QuerySummarySchema)) query: QuerySummaryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.summaryService.getSummary(user.id, query)
    return new ApiResponse('Summary retrieved.', result)
  }
}
