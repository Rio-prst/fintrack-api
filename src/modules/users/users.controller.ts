import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common'
import type { RequestUser } from '../../common/decorators/current-user.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ApiResponse } from '../../common/interceptors/api.response'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import type { UpdateUserDto } from './dto/update-user.dto'
import { UpdateUserSchema } from './dto/update-user.dto'
import { UserService } from './users.service'

@Controller('users')
export class UserController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  @Get(':id')
  async getProfile(@Param('id', ParseIntPipe) id: number) {
    if (id <= 0) {
      throw new BadRequestException({ code: 'validation.failed', message: 'Invalid user ID' })
    }
    const user = await this.userService.getProfile(id)
    return new ApiResponse('User found.', { user })
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (id <= 0) {
      throw new BadRequestException({ code: 'validation.failed', message: 'Invalid user ID' })
    }
    const updatedUser = await this.userService.updateProfile(user.id, id, dto)
    return new ApiResponse('User updated.', { user: updatedUser })
  }
}
