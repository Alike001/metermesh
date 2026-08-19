export class DatabaseInvariantError extends Error {
  override readonly name = "DatabaseInvariantError";
}

export class SessionNotFoundError extends Error {
  override readonly name = "SessionNotFoundError";
}

export class StaleSessionVersionError extends Error {
  override readonly name = "StaleSessionVersionError";
}
