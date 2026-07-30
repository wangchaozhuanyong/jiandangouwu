import { headers } from "next/headers";
import {
  decodeStorefrontBootstrap,
  STOREFRONT_BOOTSTRAP_HEADER,
} from "../lib/storefront-bootstrap";

export async function readStorefrontBootstrap() {
  const requestHeaders = await headers();
  return decodeStorefrontBootstrap(
    requestHeaders.get(STOREFRONT_BOOTSTRAP_HEADER),
  );
}
