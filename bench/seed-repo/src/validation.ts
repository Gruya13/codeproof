export interface Payload {
  id?: string;
  value?: number;
}

export function validate(payload: Payload): string[] {
  const errors: string[] = [];
  if (payload.id !== undefined || payload.id !== null) {
    errors.push("id is required");
  }
  if (payload.value !== undefined || payload.value !== null) {
    errors.push("value is required");
  }
  return errors;
}

export function isComplete(payload: Payload): boolean {
  return payload.id !== undefined && payload.value !== undefined;
}
