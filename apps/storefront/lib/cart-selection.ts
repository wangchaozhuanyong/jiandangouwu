/**
 * Keeps cart selection intentionally local to the rendered cart page.
 * New cart entries opt in by default; entries removed elsewhere disappear
 * from the local selection without affecting the remaining choices.
 */
export function reconcileSelectedItemIds(
  itemIds: readonly string[],
  knownItemIds: ReadonlySet<string>,
  selectedItemIds: ReadonlySet<string>,
): Set<string> {
  const currentItemIds = new Set(itemIds);
  const next = new Set(
    [...selectedItemIds].filter((itemId) => currentItemIds.has(itemId)),
  );

  for (const itemId of currentItemIds) {
    if (!knownItemIds.has(itemId)) {
      next.add(itemId);
    }
  }

  return next;
}

export function toggleSelectedItemId(
  selectedItemIds: ReadonlySet<string>,
  itemId: string,
): Set<string> {
  const next = new Set(selectedItemIds);

  if (next.has(itemId)) {
    next.delete(itemId);
  } else {
    next.add(itemId);
  }

  return next;
}
