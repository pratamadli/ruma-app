# Grocery

One shared grocery list per family (auto-created on first access).

## Capabilities

- Add / edit / remove items
- Quantity + optional category
- Check / uncheck
- Clear completed

## API

- `GET /v1/families/:familyId/grocery`
- `POST /v1/families/:familyId/grocery/items`
- `PATCH/DELETE /v1/families/:familyId/grocery/items/:itemId`
- `POST /v1/families/:familyId/grocery/clear-completed`

## Activity

- `GROCERY_ITEM_ADDED`, `GROCERY_ITEM_COMPLETED`  
  No per-item notifications (noise control).
