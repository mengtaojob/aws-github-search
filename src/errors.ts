export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter?: string) {
    super(message);
    this.name = 'ApiError';
  }
}
