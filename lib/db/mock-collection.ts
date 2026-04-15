/**
 * Coleções em memória quando DATABASE_DISABLED está ativo.
 */

function randomObjectIdHex(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function idString(x: unknown): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && "toString" in x) {
    return String((x as { toString: () => string }).toString());
  }
  return String(x);
}

function matchValue(docVal: unknown, cond: unknown): boolean {
  if (cond === null || cond === undefined) return docVal === cond;
  if (cond instanceof Date) return docVal instanceof Date && docVal.getTime() === cond.getTime();
  if (typeof cond !== "object" || Array.isArray(cond)) {
    return docVal === cond;
  }
  const o = cond as Record<string, unknown>;
  if ("$lte" in o) {
    const limit = o.$lte instanceof Date ? o.$lte.getTime() : Number(o.$lte);
    const t = docVal instanceof Date ? docVal.getTime() : Number(docVal);
    return !Number.isNaN(t) && t <= limit;
  }
  if ("$gte" in o) {
    const limit = o.$gte instanceof Date ? o.$gte.getTime() : Number(o.$gte);
    const t = docVal instanceof Date ? docVal.getTime() : Number(docVal);
    return !Number.isNaN(t) && t >= limit;
  }
  if ("$ne" in o) {
    return docVal !== o.$ne;
  }
  if ("$regex" in o) {
    const re = new RegExp(String(o.$regex), String(o.$options ?? ""));
    return re.test(String(docVal ?? ""));
  }
  return false;
}

function matchFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  if (Object.keys(filter).length === 0) return true;
  for (const [key, val] of Object.entries(filter)) {
    if (key === "$or") {
      const arr = val as Record<string, unknown>[];
      if (!Array.isArray(arr) || !arr.some((f) => matchFilter(doc, f))) return false;
      continue;
    }
    if (key === "$and") {
      const arr = val as Record<string, unknown>[];
      if (!Array.isArray(arr) || !arr.every((f) => matchFilter(doc, f))) return false;
      continue;
    }
    const dv = doc[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      if (!matchValue(dv, val)) return false;
      continue;
    }
    if (key === "_id") {
      if (idString(dv) !== idString(val)) return false;
      continue;
    }
    if (dv !== val) return false;
  }
  return true;
}

function applySet(doc: Record<string, unknown>, $set: Record<string, unknown>) {
  Object.assign(doc, $set);
}

const stores = new Map<string, Record<string, unknown>[]>();

function docsFor(collectionName: string): Record<string, unknown>[] {
  if (!stores.has(collectionName)) stores.set(collectionName, []);
  return stores.get(collectionName)!;
}

export function createMockCollection(collectionName: string) {
  const docs = () => docsFor(collectionName);

  const cursorFrom = (list: Record<string, unknown>[]) => {
    let sorted = [...list];
    let skipN = 0;
    let limitN = Infinity;
    let projection: Record<string, 1 | 0> | null = null;

    const chain = {
      sort(_spec: Record<string, 1 | -1>) {
        return chain;
      },
      skip(n: number) {
        skipN = n;
        return chain;
      },
      limit(n: number) {
        limitN = n;
        return chain;
      },
      project(spec: Record<string, 1 | 0>) {
        projection = spec;
        return chain;
      },
      async toArray(): Promise<Record<string, unknown>[]> {
        let out = sorted.slice(skipN, skipN + limitN);
        const proj = projection;
        if (proj) {
          out = out.map((d) => {
            const next: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(proj)) {
              if (v === 1 && k in d) next[k] = d[k];
            }
            return next;
          });
        }
        return out;
      },
    };
    return chain;
  };

  return {
    async findOne(filter: Record<string, unknown> = {}) {
      return docs().find((d) => matchFilter(d, filter)) ?? null;
    },

    find(filter: Record<string, unknown> = {}) {
      const list = docs().filter((d) => matchFilter(d, filter));
      return cursorFrom(list);
    },

    async countDocuments(filter: Record<string, unknown> = {}) {
      return docs().filter((d) => matchFilter(d, filter)).length;
    },

    async insertOne(doc: Record<string, unknown>) {
      const _id = doc._id ?? randomObjectIdHex();
      const row = { ...doc, _id };
      docs().push(row);
      return {
        insertedId: {
          toString: () => idString(_id),
        },
      };
    },

    async updateOne(filter: Record<string, unknown>, update: { $set?: Record<string, unknown> }) {
      const d = docs().find((x) => matchFilter(x, filter));
      if (!d) return { matchedCount: 0, modifiedCount: 0 };
      if (update.$set) applySet(d, update.$set);
      return { matchedCount: 1, modifiedCount: 1 };
    },

    async updateMany(filter: Record<string, unknown>, update: { $set?: Record<string, unknown> }) {
      let n = 0;
      for (const d of docs()) {
        if (matchFilter(d, filter) && update.$set) {
          applySet(d, update.$set);
          n++;
        }
      }
      return { matchedCount: n, modifiedCount: n };
    },

    async deleteOne(filter: Record<string, unknown>) {
      const arr = docs();
      const i = arr.findIndex((x) => matchFilter(x, filter));
      if (i === -1) return { deletedCount: 0 };
      arr.splice(i, 1);
      return { deletedCount: 1 };
    },

    async deleteMany(filter: Record<string, unknown>) {
      const arr = docs();
      const keep = arr.filter((x) => !matchFilter(x, filter));
      const n = arr.length - keep.length;
      arr.length = 0;
      arr.push(...keep);
      return { deletedCount: n };
    },

    aggregate(_pipeline: unknown[]) {
      return {
        async toArray() {
          return [] as Record<string, unknown>[];
        },
      };
    },
  };
}

export type MockCollection = ReturnType<typeof createMockCollection>;
