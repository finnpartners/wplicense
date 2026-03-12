import type { Request } from "express";

interface EasyAuthUser {
  id: string;
  email: string;
  name: string;
}

export function getEasyAuthUser(req: Request): EasyAuthUser | null {
  const id = req.headers["x-ms-client-principal-id"] as string | undefined;
  const name = req.headers["x-ms-client-principal-name"] as string | undefined;

  if (!id || !name) {
    return null;
  }

  return { id, email: name, name };
}
