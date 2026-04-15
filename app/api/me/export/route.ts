import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, mapDocs, routeObjectId, isDatabaseDisabled } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const accountId = session.user.accountId;

  if (isDatabaseDisabled()) {
    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        account: null,
        users: [],
        leads: [],
        checkoutEventsCount: 0,
        message:
          "Modo sem banco (DATABASE_DISABLED): não há dados para exportar. Configure MongoDB para exportação real.",
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="loopsale-dados-demo.json"`,
        },
      }
    );
  }

  const accountsCol = await getCollection("accounts");
  const usersCol = await getCollection("users");
  const leadsCol = await getCollection("leads");
  const checkoutEventsCol = await getCollection("checkoutEvents");

  const accountOid = await routeObjectId(accountId);
  const account = accountOid
    ? await accountsCol.findOne({ _id: accountOid })
    : null;
  const accountMapped = account ? mapDoc(account) : null;
  const accountForExport = accountMapped
    ? { id: accountMapped.id, name: accountMapped.name, slug: accountMapped.slug, createdAt: accountMapped.createdAt }
    : null;

  const usersList = await usersCol.find({ accountId }).toArray();
  const usersForExport = mapDocs(usersList).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
  }));

  const leadsList = await leadsCol.find({ accountId }).toArray();
  const leadsForExport = mapDocs(leadsList).map((l) => ({
    id: l.id,
    email: l.email,
    phone: l.phone,
    name: l.name,
    source: l.source,
    status: l.status,
    createdAt: l.createdAt,
  }));

  const eventsCount = await checkoutEventsCol.countDocuments({ accountId });

  const exportData = {
    exportedAt: new Date().toISOString(),
    account: accountForExport,
    users: usersForExport,
    leads: leadsForExport,
    checkoutEventsCount: eventsCount,
    message:
      "Dados exportados conforme LGPD. Dados sensíveis (ex.: senha) não estão incluídos.",
  };

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="loopsale-dados-${String(accountId).slice(0, 8)}.json"`,
    },
  });
}
