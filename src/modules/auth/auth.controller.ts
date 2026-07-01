import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { RequestUser } from '../../common/decorators/current-user.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ApiResponse } from '../../common/interceptors/api.response'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthService } from './auth.service'
import type { LoginDto } from './dto/login.dto'
import { LoginSchema } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'
import { RegisterSchema } from './dto/register.dto'

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.register(dto)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return new ApiResponse('Registration successful.', { user, accessToken })
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.login(dto)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return new ApiResponse('Login successful.', { user, accessToken })
  }

  @Post('rotate')
  @HttpCode(200)
  async rotate(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let token = req.cookies?.refresh_token

    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/refresh_token=([^;]+)/)
      if (match) {
        token = match[1]
      }
    }

    const { accessToken, refreshToken } = await this.authService.rotate(token)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return new ApiResponse('Token rotated.', { accessToken })
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let token = req.cookies?.refresh_token

    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/refresh_token=([^;]+)/)
      if (match) {
        token = match[1]
      }
    }

    if (token) {
      await this.authService.logout(token)
    }

    res.cookie('refresh_token', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    })

    return new ApiResponse('Logged out successfully.')
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    return new ApiResponse('User profile retrieved.', { user })
  }
}
