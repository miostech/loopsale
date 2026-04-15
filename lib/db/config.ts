/**
 * Com DATABASE_DISABLED=true o app não conecta ao MongoDB.
 * Use para testar a UI; depois remova a variável e configure MONGODB_URI.
 */
export function isDatabaseDisabled(): boolean {
  const v = process.env.DATABASE_DISABLED;
  return v === "true" || v === "1" || v === "yes";
}
