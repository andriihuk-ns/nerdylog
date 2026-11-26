import type { Db } from "../client";

/** A transaction handle from `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Queries accept either the pooled client or an open transaction. */
export type DbOrTx = Db | Tx;
