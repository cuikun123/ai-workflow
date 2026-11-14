export const exitCodes = Object.freeze({ USAGE: 2, ENVIRONMENT: 3, PACKAGE_INVALID: 4, STATE_INVALID: 5, IO: 6, CONFLICT: 7, INCOMPLETE: 8 });
export class WorkflowError extends Error {
  constructor(code, message, details = []) {
    super(message); this.name = 'WorkflowError'; this.code = code; this.details = details;
  }
}
export function asWorkflowError(error) {
  if (error instanceof WorkflowError) return error;
  if (['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error?.code)) return new WorkflowError('PACKAGE_INVALID', 'Runtime dependency is missing', [error.code]);
  return new WorkflowError('IO', 'Operation failed', [error?.code || 'UNKNOWN']);
}
