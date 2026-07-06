export class RequestTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = "RequestTimeoutError";
  }
}

export async function withTimeout<T>(request: PromiseLike<T>, label: string, ms = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RequestTimeoutError(label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function safeErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof RequestTimeoutError) return "The request took too long. Please try again.";
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

