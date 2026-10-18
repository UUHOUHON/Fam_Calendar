import { randomBytes } from "crypto";

export function createToken() {
  return randomBytes(24).toString("hex");
}
