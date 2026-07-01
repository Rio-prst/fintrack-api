import crypto from 'node:crypto'
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common'
import { ZodError } from 'zod'
import type {
  ExceptionResponseObject,
  ValidationError,
} from '../types/exception-response.interface'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toValidationErrors(value: unknown): ValidationError[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((item) => ({
    field: String(item.field ?? ''),
    code: String(item.code ?? ''),
    message: String(item.message ?? ''),
  }))
}

@Injectable()
@Catch()
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<{
      status: (statusCode: number) => { json: (body: unknown) => void }
    }>()

    const requestId = `req_${crypto.randomUUID()}`

    if (exception instanceof ZodError) {
      const formattedErrors: ValidationError[] = exception.issues.map((err) => {
        const rawCode: string = err.code
        let errorCode = rawCode

        if (rawCode === 'invalid_string') {
          errorCode = 'invalid'
        }

        return {
          field: err.path.join('.'),
          code: errorCode,
          message: err.message,
        }
      })

      const errorBody: ExceptionResponseObject = {
        message: 'Validation failed.',
        requestId,
        code: 'validation.failed',
        error: formattedErrors,
      }

      response.status(HttpStatus.BAD_REQUEST).json(errorBody)
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const resContent = exception.getResponse()

      let message = exception.message
      let code = 'error.internal'

      if (isRecord(resContent)) {
        if (typeof resContent.message === 'string') message = resContent.message
        if (typeof resContent.code === 'string') code = resContent.code
        if ('error' in resContent) {
          response
            .status(status)
            .json({ message, requestId, code, error: toValidationErrors(resContent.error) })
          return
        }
      }

      response.status(status).json({ message, requestId, code })
      return
    }

    console.error(exception)
    const fallbackBody: ExceptionResponseObject = {
      message: 'Internal server error.',
      requestId,
      code: 'server.error',
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fallbackBody)
  }
}
