import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CatalogQueryDto, LocaleQueryDto } from "./catalog.dto.js";
import { CatalogService } from "./catalog.service.js";

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("storefront/config")
  config(@Query() query: LocaleQueryDto) {
    return this.catalog.storefrontConfig(query.locale);
  }

  @Get("categories")
  categories(@Query() query: LocaleQueryDto) {
    return this.catalog.categories(query.locale);
  }

  @Get("products")
  products(@Query() query: CatalogQueryDto) {
    return this.catalog.products(query);
  }

  @Get("products/:slug")
  product(@Param("slug") slug: string, @Query() query: LocaleQueryDto) {
    return this.catalog.product(slug, query);
  }
}
