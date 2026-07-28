const CATEGORY_STORAGE_KEY = "cloudbridge-product-categories";
const PRODUCT_CATEGORY_STORAGE_KEY = "cloudbridge-product-category-assignments";

export function normalizeProductQuery(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function filterCatalogProducts(items, { query = "", categoryId = "all" } = {}) {
  const terms = normalizeProductQuery(query).split(" ").filter(Boolean);
  return items.filter((product) => {
    if (categoryId !== "all" && product.categoryId !== categoryId) return false;
    if (!terms.length) return true;
    const productName = normalizeProductQuery(`${product.name.zh} ${product.name.en}`);
    return terms.every((term) => productName.includes(term));
  });
}

export function sortProductCategories(categories) {
  return [...categories].sort((a, b) => a.order - b.order);
}

export function moveProductCategory(categories, categoryId, direction) {
  const sorted = sortProductCategories(categories);
  const index = sorted.findIndex((category) => category.id === categoryId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return sorted;
  [sorted[index], sorted[nextIndex]] = [sorted[nextIndex], sorted[index]];
  return sorted.map((category, order) => ({ ...category, order: order + 1 }));
}

export function readProductCategories(storage, fallback) {
  try {
    const parsed = JSON.parse(storage?.getItem(CATEGORY_STORAGE_KEY) || "null");
    if (!Array.isArray(parsed) || !parsed.length) return fallback;
    const valid = parsed.every((category) => (
      typeof category?.id === "string"
      && typeof category?.name?.zh === "string"
      && category.name.zh.trim()
      && typeof category?.name?.en === "string"
      && category.name.en.trim()
      && typeof category?.active === "boolean"
      && Number.isFinite(category?.order)
    ));
    return valid ? sortProductCategories(parsed) : fallback;
  } catch {
    return fallback;
  }
}

export function saveProductCategories(storage, categories) {
  try {
    storage?.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(sortProductCategories(categories)));
    return true;
  } catch {
    return false;
  }
}

export function readProductCategoryAssignments(storage, items) {
  const defaults = Object.fromEntries(items.map((product) => [product.id, product.categoryId]));
  try {
    const parsed = JSON.parse(storage?.getItem(PRODUCT_CATEGORY_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    return Object.fromEntries(items.map((product) => [
      product.id,
      typeof parsed[product.id] === "string" ? parsed[product.id] : defaults[product.id],
    ]));
  } catch {
    return defaults;
  }
}

export function saveProductCategoryAssignments(storage, assignments) {
  try {
    storage?.setItem(PRODUCT_CATEGORY_STORAGE_KEY, JSON.stringify(assignments));
    return true;
  } catch {
    return false;
  }
}
