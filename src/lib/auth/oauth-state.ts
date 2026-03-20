import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { env } from "@/lib/supabase/env";

function getStateSecret() {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  }

  return new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY);
}

export async function signOAuthState(payload: Record<string, unknown>, expiresIn = "10m") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getStateSecret());
}

export async function verifyOAuthState<T>(token: string) {
  const verified = await jwtVerify(token, getStateSecret());
  return verified.payload as T;
}
