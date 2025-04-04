export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: any,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string | number) {
    super(`${entity}${id ? ` com ID ${id}` : ''} não encontrado(a)`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Acesso não autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso proibido') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, details);
  }
}

export class PdfProcessingError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(`Falha no processamento do PDF: ${message}`, 422);
  }
}

export class FileOperationError extends AppError {
  constructor(
    operation: 'save' | 'move' | 'delete',
    path: string,
    originalError?: Error,
  ) {
    super(`Falha ao ${operation} arquivo em ${path}`, 500, {
      originalError: originalError?.message,
    });
  }
}

export class DatabaseError extends AppError {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly parameters?: any[],
    public readonly originalError?: Error,
  ) {
    super(`Database error: ${message}`, 500, {
      query,
      parameters: parameters?.map((p: object | string) =>
        typeof p === 'object' ? JSON.stringify(p) : p,
      ),
      originalError: originalError?.message,
    });
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, details);
  }
}
