export class InvalidRoundStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRoundStateError";
  }
}

export class InvalidBetStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBetStateError";
  }
}
