export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message)
  }
}

export const notFound = () =>
  new ApiError(404, "not_found", "Analysis not found or no longer available.")
