import crypto from 'node:crypto'
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { map, type Observable } from 'rxjs'
import type { ControllerResponse } from '../types/controller-response.interface'
import { ApiResponse } from './api.response'

@Injectable()
export class ResponseInterceptor
  implements NestInterceptor<unknown, ControllerResponse | undefined>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ControllerResponse | undefined> {
    const requestId = `req_${crypto.randomUUID()}`

    return next.handle().pipe(
      map((result: unknown) => {
        const httpResponse = _context.switchToHttp().getResponse<{ statusCode: number }>()
        if (httpResponse.statusCode === 204) return undefined

        if (result instanceof ApiResponse) {
          const envelope: ControllerResponse = {
            message: result.message,
            requestId,
          }

          if (result.meta !== undefined) envelope.meta = result.meta
          if (result.data !== undefined) envelope.data = result.data

          return envelope
        }

        const fallbackEnvelope: ControllerResponse = {
          message: 'Request successful.',
          requestId,
        }

        if (result !== null && result !== undefined) {
          fallbackEnvelope.data = result
        }

        return fallbackEnvelope
      }),
    )
  }
}
