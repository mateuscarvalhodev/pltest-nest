import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Erro interno do servidor';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      message,
      path: ctx.getRequest<Request>().url,
    };

    this.logger.error(
      `${errorResponse.message} - ${exception.stack}`,
      'ExceptionFilter',
    );

    response.status(status).json(errorResponse);
  }
}
