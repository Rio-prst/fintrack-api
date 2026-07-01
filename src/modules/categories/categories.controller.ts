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
import { CategoriesService } from './categories.service'
import type { CreateCategoryDto } from './dto/create-category.dto'
import { CreateCategorySchema } from './dto/create-category.dto'
import type { UpdateCategoryDto } from './dto/update-category.dto'
import { UpdateCategorySchema } from './dto/update-category.dto'

@Controller('categories')
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const category = await this.categoriesService.create(user.id, dto)
    return new ApiResponse('Category created.', { category })
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@CurrentUser() user: RequestUser, @Query('type') type?: string) {
    const categories = await this.categoriesService.findAll(user.id, type)
    return new ApiResponse('Categories retrieved.', categories)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const category = await this.categoriesService.update(id, user.id, dto)
    return new ApiResponse('Category updated.', { category })
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: RequestUser) {
    await this.categoriesService.delete(id, user.id)
  }
}
