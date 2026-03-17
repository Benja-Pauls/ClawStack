---
name: clawstack-scaffold
description: "Generate boilerplate for new API endpoints and frontend pages in ClawStack. Use when: adding a new resource, creating CRUD endpoints, wiring up a new frontend page."
metadata:
  {
    "openclaw":
      {
        "emoji": "🏗️",
        "requires": { "bins": ["uv", "node"] },
      },
  }
---

# Scaffold

Generate boilerplate for new API endpoints and frontend pages in ClawStack.

## Adding a New API Endpoint

Given a resource name (e.g., `projects`), create the following files in order.

### 1. SQLAlchemy Model -- `backend/app/models/{name}.py`

Inherit from `Base` which provides `id` (UUID), `created_at`, and `updated_at` automatically.

```python
from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class {Name}(Base):
    __tablename__ = "{name}s"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
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

Uses synchronous SQLAlchemy sessions. Each function takes a `Session` and returns model instances or raises `HTTPException`.

```python
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.{name} import {Name}
from app.schemas.{name} import {Name}Create, {Name}Update


def create_{name}(db: Session, data: {Name}Create) -> {Name}:
    item = {Name}(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_{name}(db: Session, {name}_id: UUID) -> {Name}:
    item = db.get({Name}, {name}_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="{Name} not found")
    return item


def list_{name}s(db: Session, skip: int = 0, limit: int = 100) -> tuple[list[{Name}], int]:
    total = db.scalar(select(func.count()).select_from({Name}))
    items = list(db.scalars(select({Name}).offset(skip).limit(limit)).all())
    return items, total or 0


def update_{name}(db: Session, {name}_id: UUID, data: {Name}Update) -> {Name}:
    item = get_{name}(db, {name}_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_{name}(db: Session, {name}_id: UUID) -> None:
    item = get_{name}(db, {name}_id)
    db.delete(item)
    db.commit()
```

### 4. Router -- `backend/app/routes/{name}.py`

Route handlers use sync `def` (not `async def`). FastAPI runs them in a threadpool automatically.

```python
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.base import get_db
from app.schemas.{name} import {Name}Create, {Name}Update, {Name}Response, {Name}ListResponse
from app.services.{name} import create_{name}, get_{name}, list_{name}s, update_{name}, delete_{name}

router = APIRouter(prefix="/{name}s", tags=["{name}s"])


@router.post("", response_model={Name}Response, status_code=201)
def create(data: {Name}Create, db: Session = Depends(get_db)):
    return create_{name}(db, data)


@router.get("", response_model={Name}ListResponse)
def list_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items, total = list_{name}s(db, skip, limit)
    return {Name}ListResponse({name}s=items, total=total, skip=skip, limit=limit)


@router.get("/{{{name}_id}}", response_model={Name}Response)
def read({name}_id: UUID, db: Session = Depends(get_db)):
    return get_{name}(db, {name}_id)


@router.put("/{{{name}_id}}", response_model={Name}Response)
def update({name}_id: UUID, data: {Name}Update, db: Session = Depends(get_db)):
    return update_{name}(db, {name}_id, data)


@router.delete("/{{{name}_id}}", status_code=204)
def delete({name}_id: UUID, db: Session = Depends(get_db)):
    delete_{name}(db, {name}_id)
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

Tests use the in-memory SQLite test client from `conftest.py`. No running Postgres needed.

```python
from fastapi.testclient import TestClient

from app.main import create_app

# Use the test fixtures from conftest.py (client, db session with rollback)

def test_create_{name}(client: TestClient):
    response = client.post("/api/v1/{name}s", json={{"title": "Test {Name}"}})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test {Name}"
    assert "id" in data

def test_list_{name}s(client: TestClient):
    response = client.get("/api/v1/{name}s")
    assert response.status_code == 200
    data = response.json()
    assert "{name}s" in data
    assert "total" in data

def test_get_{name}_not_found(client: TestClient):
    response = client.get("/api/v1/{name}s/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
```

---

## Adding a New Frontend Page

Given a page name (e.g., `Projects`):

### 1. TypeScript Types -- `frontend/src/types/{name}.ts`

Must mirror backend Pydantic schemas. Use `string` for UUID `id` fields.

```typescript
export interface {Name} {{
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}}

export interface {Name}Create {{
  title: string;
  description?: string;
}}

export interface {Name}Update {{
  title?: string;
  description?: string;
}}

export interface {Name}ListResponse {{
  {name}s: {Name}[];
  total: number;
  skip: number;
  limit: number;
}}
```

### 2. API Client -- `frontend/src/api/{name}.ts`

```typescript
import {{ api }} from "./client";
import type {{ {Name}, {Name}Create, {Name}Update, {Name}ListResponse }} from "../types/{name}";

export const get{Name}s = (): Promise<{Name}ListResponse> => api.get("/{name}s");
export const get{Name} = (id: string): Promise<{Name}> => api.get(`/{name}s/${{id}}`);
export const create{Name} = (data: {Name}Create): Promise<{Name}> => api.post("/{name}s", data);
export const update{Name} = (id: string, data: {Name}Update): Promise<{Name}> => api.put(`/{name}s/${{id}}`, data);
export const delete{Name} = (id: string): Promise<void> => api.delete(`/{name}s/${{id}}`);
```

### 3. React Query Hooks -- `frontend/src/hooks/use{Name}s.ts`

```typescript
import {{ useQuery, useMutation, useQueryClient }} from "@tanstack/react-query";
import {{ get{Name}s, create{Name}, update{Name}, delete{Name} }} from "../api/{name}";
import type {{ {Name}Create, {Name}Update }} from "../types/{name}";

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
    mutationFn: ({{ id, data }}: {{ id: string; data: {Name}Update }}) => update{Name}(id, data),
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
