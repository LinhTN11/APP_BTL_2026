import { createHash, randomUUID } from "node:crypto";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, code, message);
};

export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const uid = () => randomUUID();
