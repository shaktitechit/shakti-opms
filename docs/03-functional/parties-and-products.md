# Module: Parties & Products

## Purpose
Maintain commercial masters: parties, zones, products, kits, brands, manufacturers, party-product rates.

## Actors
OPMS admin/finance/account/super_admin primarily; APIs require auth (+ department middleware currently effectively auth-only in party/product).

## Workflows
- CRUD + soft-delete/restore/bulk operations
- Zone attach parties and sales persons
- Party product mapping + rate approve
- Google Sheet webhook ingest

## Related APIs
party-service: `/api/parties`, `/api/zones`, `/api/party-products`, `/api/party-order-products-rate`  
product-service: `/api/products`, `/api/product-groups`, `/api/product-subgroups`, `/api/product-brands`, `/api/product-manufacturers`, `/api/product-kit-items`  
Also reachable via opms-backend proxy.

## Related DB
Party, Zone, Product, ProductKitItem, ProductGroup, ProductSubgroup, ProductBrand, ProductManufacturer, Batch, PartyProductMapping, PartyProductRate, PartyProductLastRate

## Related UI
opms-frontend Party Master / Product Master sections

## Source
`party-service/`, `product-service/`
