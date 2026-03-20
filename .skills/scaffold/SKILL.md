---
name: scaffold
description: "Generate boilerplate for new API endpoints and frontend pages following this project's conventions (flush/commit transaction pattern, ownership enforcement, domain returns). Use when: adding a new resource, creating CRUD endpoints, wiring up a new frontend page, or asking 'how do I add a new feature end-to-end.'"
---

# Scaffold

Generate boilerplate for new API endpoints and frontend pages in SerpentStack.

## Adding a New API Endpoint

Given a resource name (e.g., `projects`), create the following files in order.

### 1. SQLAlchemy Model -- `backend/app/models/{name}.py`

Inherit from `Base` which provides `id` (UUID), `created_at`, and `updated_at` automatically.

```python
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class {Name}(Base):
    __tablename__ = "{name}s"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Owner — see Item model for the reference pattern
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
```

Register the model by adding to `backend/app/models/__init__.py`:

```python
from app.models.{name} import {Name}
```

### 2. Pydantic Schemas -- `backend/app/schemas/{name}.py`

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class {Name}Base(BaseModel):
    title: str
    description: str | None = None

class {Name}Create({Name}Base):
    pass

class {Name}Update(BaseModel):
    title: str | None = None
    description: str | None = None

class {Name}Response({Name}Base):
    id: UUID
    is_active: bool
    user_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class {Name}ListResponse(BaseModel):
    {name}s: list[{Name}Response]
    total: int
    skip: int
    limit: int
```

### 3. Service Layer -- `backend/app/services/{name}.py`

Uses async SQLAlchemy sessions. Services return `None` or domain values — they **never** raise `HTTPException`. Services **flush but do not commit** — the route layer owns the transaction boundary. This allows multiple service calls to be composed in a single transaction.

```python
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.{name} import {Name}
from app.schemas.{name} import {Name}Create, {Name}Update


class {Name}Service:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: {Name}Create, *, user_id: UUID | None = None) -> {Name}:
        item = {Name}(**data.model_dump(), user_id=user_id)
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def get(self, {name}_id: UUID) -> {Name} | None:
        stmt = select({Name}).where({Name}.id == {name}_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(self, skip: int = 0, limit: int = 100) -> tuple[list[{Name}], int]:
        total = await self.db.scalar(select(func.count()).select_from({Name}))
        result = await self.db.execute(select({Name}).offset(skip).limit(limit))
        return list(result.scalars().all()), total or 0

    async def update(self, {name}_id: UUID, data: {Name}Update, *, user_id: UUID) -> object:
        """Update with ownership check.

        Returns:
            {Name} — updated successfully
            None   — not found
            False  — exists but owned by a different user
        """
        item = await self.get({name}_id)
        if item is None:
            return None
        if item.user_id is not None and item.user_id != user_id:
            return False
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def delete(self, {name}_id: UUID, *, user_id: UUID) -> bool | None:
        """Delete with ownership check.

        Returns:
            True  — deleted successfully
            None  — not found
            False — exists but owned by a different user
        """
        item = await self.get({name}_id)
        if item is None:
            return None
        if item.user_id is not None and item.user_id != user_id:
            return False
        await self.db.delete(item)
        await self.db.flush()
        return True
```

### 4. Router -- `backend/app/routes/{name}.py`

Route handlers use `async def` and translate service results (None → 404, bool → 204/404) into HTTP responses. Services never raise HTTPException. **Routes own the transaction** — they call `await db.commit()` after successful mutations. `Depends(get_db)` is cached per-request, so the route's `db` and the service's `self.db` are the same session.

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.routes.auth import UserInfo, get_current_user, get_optional_user
from app.schemas.{name} import {Name}Create, {Name}Update, {Name}Response, {Name}ListResponse
from app.services.{name} import {Name}Service

router = APIRouter(prefix="/{name}s", tags=["{name}s"])


async def get_service(db: AsyncSession = Depends(get_db)) -> {Name}Service:
    return {Name}Service(db)


@router.post("", response_model={Name}Response, status_code=201)
async def create(
    data: {Name}Create,
    user: UserInfo | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
    service: {Name}Service = Depends(get_service),
):
    user_id = UUID(user.user_id) if user else None
    item = await service.create(data, user_id=user_id)
    await db.commit()
    return item


@router.get("", response_model={Name}ListResponse)
async def list_all(skip: int = 0, limit: int = 100, service: {Name}Service = Depends(get_service)):
    items, total = await service.list(skip, limit)
    return {Name}ListResponse({name}s=items, total=total, skip=skip, limit=limit)


@router.get("/{{{name}_id}}", response_model={Name}Response)
async def read({name}_id: UUID, service: {Name}Service = Depends(get_service)):
    item = await service.get({name}_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="{Name} not found")
    return item


@router.put("/{{{name}_id}}", response_model={Name}Response)
async def update(
    {name}_id: UUID,
    data: {Name}Update,
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: {Name}Service = Depends(get_service),
):
    result = await service.update({name}_id, data, user_id=UUID(user.user_id))
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="{Name} not found")
    if result is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own {name}s")
    await db.commit()
    return result


@router.delete("/{{{name}_id}}", status_code=204)
async def delete(
    {name}_id: UUID,
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: {Name}Service = Depends(get_service),
):
    result = await service.delete({name}_id, user_id=UUID(user.user_id))
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="{Name} not found")
    if result is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own {name}s")
    await db.commit()
```

### 5. Register the Router

In `backend/app/main.py`, inside `create_app()`, add:

```python
from app.routes.{name} import router as {name}_router
app.include_router({name}_router, prefix="/api/v1")
```

### 6. Generate Migration

```bash
cd backend && uv run alembic revision --autogenerate -m "add {name}s table"
cd backend && uv run alembic upgrade head
```

### 7. Add Tests -- `backend/tests/test_{name}.py`

Tests use a real PostgreSQL container via testcontainers (see `conftest.py`) and async httpx `AsyncClient`. The `@pytest.mark.asyncio` decorator is **not needed** — `asyncio_mode = "auto"` is set in `pyproject.toml`.

```python
from httpx import AsyncClient


async def test_create_{name}(client: AsyncClient):
    response = await client.post("/api/v1/{name}s", json={{"title": "Test {Name}"}})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test {Name}"
    assert "id" in data


async def test_list_{name}s(client: AsyncClient):
    response = await client.get("/api/v1/{name}s")
    assert response.status_code == 200
    data = response.json()
    assert "{name}s" in data
    assert "total" in data


async def test_get_{name}_not_found(client: AsyncClient):
    response = await client.get("/api/v1/{name}s/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
```

### 8. Auto-generate Frontend Types

After adding or changing backend schemas, regenerate the frontend TypeScript types:

```bash
make types
```

This runs `openapi-typescript` against the running backend's OpenAPI spec to produce `frontend/src/types/api.generated.ts`. See [Type Generation](#type-generation) below.

---

## Adding a New Frontend Page

Given a page name (e.g., `Projects`):

### 1. TypeScript Types

Types are auto-generated from the backend's OpenAPI spec (see step 8 above). Import them from the generated file:

```typescript
import type {{ components }} from "../types/api.generated";

type {Name} = components["schemas"]["{Name}Response"];
type {Name}Create = components["schemas"]["{Name}Create"];
type {Name}ListResponse = components["schemas"]["{Name}ListResponse"];
```

If you need custom types beyond what the API provides, add them to `frontend/src/types/{name}.ts`.

### 2. API Client -- `frontend/src/api/{name}.ts`

```typescript
import {{ apiRequest }} from "./client";
import type {{ components }} from "../types/api.generated";

type {Name} = components["schemas"]["{Name}Response"];
type {Name}Create = components["schemas"]["{Name}Create"];
type {Name}ListResponse = components["schemas"]["{Name}ListResponse"];

export const get{Name}s = (): Promise<{Name}ListResponse> =>
  apiRequest("/{name}s");

export const get{Name} = (id: string): Promise<{Name}> =>
  apiRequest(`/{name}s/${{id}}`);

export const create{Name} = (data: {Name}Create): Promise<{Name}> =>
  apiRequest("/{name}s", {{ method: "POST", body: JSON.stringify(data) }});

export const update{Name} = (id: string, data: Partial<{Name}>): Promise<{Name}> =>
  apiRequest(`/{name}s/${{id}}`, {{ method: "PUT", body: JSON.stringify(data) }});

export const delete{Name} = (id: string): Promise<void> =>
  apiRequest(`/{name}s/${{id}}`, {{ method: "DELETE" }});
```

### 3. React Query Hooks -- `frontend/src/hooks/use{Name}s.ts`

```typescript
import {{ useQuery, useMutation, useQueryClient }} from "@tanstack/react-query";
import {{ get{Name}s, create{Name}, update{Name}, delete{Name} }} from "../api/{name}";
import type {{ components }} from "../types/api.generated";

type {Name}Create = components["schemas"]["{Name}Create"];

export function use{Name}s() {{
  return useQuery({{ queryKey: ["{name}s"], queryFn: get{Name}s }});
}}

export function useCreate{Name}() {{
  const queryClient = useQueryClient();
  return useMutation({{
    mutationFn: (data: {Name}Create) => create{Name}(data),
    onSuccess: () => queryClient.invalidateQueries({{ queryKey: ["{name}s"] }}),
  }});
}}

export function useUpdate{Name}() {{
  const queryClient = useQueryClient();
  return useMutation({{
    mutationFn: ({{ id, data }}: {{ id: string; data: Partial<{Name}> }}) => update{Name}(id, data),
    onSuccess: () => queryClient.invalidateQueries({{ queryKey: ["{name}s"] }}),
  }});
}}

export function useDelete{Name}() {{
  const queryClient = useQueryClient();
  return useMutation({{
    mutationFn: (id: string) => delete{Name}(id),
    onSuccess: () => queryClient.invalidateQueries({{ queryKey: ["{name}s"] }}),
  }});
}}
```

### 4. Page Component -- `frontend/src/routes/{Name}s.tsx`

Create a React component that uses the hooks above. Include loading and error states. Use `data?.{name}s` to unwrap the list response.

### 5. Route Registration -- `frontend/src/App.tsx`

Add a `<Route path="/{name}s" element={{<{Name}s />}} />` inside the router configuration.

### 6. Navigation

Add a `<NavLink to="/{name}s">{Name}s</NavLink>` in the sidebar or header component.

---

## Type Generation

Frontend types are auto-generated from the backend's OpenAPI spec:

```bash
make types    # Exports OpenAPI spec from app, generates TypeScript types
```

This exports the FastAPI OpenAPI schema without starting a server, then produces `frontend/src/types/api.generated.ts`. Run this whenever you add or change backend schemas. The generated file should be committed to the repo.
