import "server-only";

/**
 * The provider may have created a payable resource even though its response
 * was not received. Callers must keep the attempt fenced until reconciliation
 * instead of retrying creation.
 */
export class PaymentCreationUncertainError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PaymentCreationUncertainError";
  }
}

export function isPaymentCreationUncertainError(
  error: unknown,
): error is PaymentCreationUncertainError {
  return error instanceof PaymentCreationUncertainError;
}
