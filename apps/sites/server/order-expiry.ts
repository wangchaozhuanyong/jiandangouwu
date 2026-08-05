import type { D1Database, D1Result } from "./types";

type ExpiredOrderCandidate = {
  id: string;
};

export type ExpiredOrderReconciliation = {
  candidates: number;
  released: number;
};

const reconciliationLimit = 100;
const expiryReason = "Reservation expired before merchant confirmation";

export async function reconcileExpiredOrders(
  db: D1Database,
  now = new Date(),
): Promise<ExpiredOrderReconciliation> {
  const reconciledAt = now.toISOString();
  const candidates = (await db.prepare(
    `SELECT id
     FROM orders
     WHERE status = 'MANUAL_PENDING'
       AND inventory_reserved = 1
       AND inventory_released_at IS NULL
       AND reserved_until <= ?
     ORDER BY reserved_until ASC, id ASC
     LIMIT ?`,
  ).bind(reconciledAt, reconciliationLimit).all<ExpiredOrderCandidate>()).results ?? [];

  if (candidates.length === 0) {
    return { candidates: 0, released: 0 };
  }

  const statements = candidates.flatMap((candidate) => {
    const historyId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    return [
      db.prepare(
        `INSERT INTO order_status_history
          (id, order_id, from_status, to_status, reason, actor_email, created_at)
         SELECT ?, id, status, 'CANCELLED', ?, NULL, ?
         FROM orders
         WHERE id = ?
           AND status = 'MANUAL_PENDING'
           AND inventory_reserved = 1
           AND inventory_released_at IS NULL
           AND reserved_until <= ?`,
      ).bind(
        historyId,
        expiryReason,
        reconciledAt,
        candidate.id,
        reconciledAt,
      ),
      db.prepare(
        `UPDATE orders
         SET status = 'CANCELLED', updated_at = ?, inventory_released_at = ?
         WHERE id = ?
           AND status = 'MANUAL_PENDING'
           AND inventory_reserved = 1
           AND inventory_released_at IS NULL
           AND reserved_until <= ?
           AND EXISTS (
             SELECT 1 FROM order_status_history
             WHERE id = ? AND order_id = ? AND to_status = 'CANCELLED'
           )`,
      ).bind(
        reconciledAt,
        reconciledAt,
        candidate.id,
        reconciledAt,
        historyId,
        candidate.id,
      ),
      db.prepare(
        `UPDATE products
         SET stock_quantity = stock_quantity + 1,
           version = version + 1,
           updated_at = ?
         WHERE id IN (
             SELECT product_id FROM order_items WHERE order_id = ?
           )
           AND stock_mode = 'FINITE'
           AND EXISTS (
             SELECT 1 FROM order_status_history
             WHERE id = ? AND order_id = ? AND to_status = 'CANCELLED'
           )`,
      ).bind(
        reconciledAt,
        candidate.id,
        historyId,
        candidate.id,
      ),
      db.prepare(
        `INSERT INTO audit_events
          (id, trace_id, action, result, actor_email, actor_display_name,
           target_type, target_id, reason, created_at)
         SELECT ?, ?, 'order.reservation.expired', 'SUCCEEDED', NULL, NULL,
           'ORDER', ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM order_status_history
           WHERE id = ? AND order_id = ? AND to_status = 'CANCELLED'
         )`,
      ).bind(
        auditId,
        traceId,
        candidate.id,
        expiryReason,
        reconciledAt,
        historyId,
        candidate.id,
      ),
    ];
  });

  const results = await db.batch(statements);
  let released = 0;
  for (let index = 1; index < results.length; index += 4) {
    released += changes(results[index]);
  }
  return { candidates: candidates.length, released };
}

function changes(result: D1Result<unknown> | undefined): number {
  return Number(result?.meta?.changes ?? 0);
}
