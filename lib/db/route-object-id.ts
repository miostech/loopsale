import { isDatabaseDisabled } from "./config";

/** Valida id hex de 24 chars e retorna valor usável em queries (_id). */
export async function routeObjectId(id: string): Promise<unknown | null> {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  if (isDatabaseDisabled()) return id;
  const { ObjectId } = await import("mongodb");
  return new ObjectId(id);
}
