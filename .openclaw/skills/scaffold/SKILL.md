# Skill: Scaffold

Generate boilerplate for new API endpoints and frontend pages in ClawStack.

## Adding a New API Endpoint

Given a resource name (e.g., `projects`), create the following files in order.

### 1. Pydantic Schemas -- `backend/app/schemas/{name}.py`

```python
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

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
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

### 2. SQLAlchemy Model -- `backend/app/models/{name}.py`

```python
from app.models.base import Base
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone

class {Name}(Base):
    __tablename__ = "{name}s"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
```

Register the model by adding to `backend/app/models/__init__.py`:

```python
from app.models.{name} import {Name}
```

### 3. Service Layer -- `backend/app/services/{name}.py`

Implement CRUD operations. Each function takes a SQLAlchemy `AsyncSession` and returns model instances or raises `HTTPException`. Methods: `create_{name}`, `get_{name}`, `list_{name}s`, `update_{name}`, `delete_{name}`.

### 4. Router -- `backend/app/routes/{name}.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.{name} import {Name}Create, {Name}Update, {Name}Response
from app.services.{name} import create_{name}, get_{name}, list_{name}s, update_{name}, delete_{name}
from app.dependencies import get_db

router = APIRouter(prefix="/{name}s", tags=["{name}s"])

@router.post("/", response_model={Name}Response, status_code=201)
async def create(data: {Name}Create, db: AsyncSession = Depends(get_db)):
    return await create_{name}(db, data)

@router.get("/{id}", response_model={Name}Response)
async def read(id: str, db: AsyncSession = Depends(get_db)):
    return await get_{name}(db, id)

@router.get("/", response_model=list[{Name}Response])
async def list_all(db: AsyncSession = Depends(get_db)):
    return await list_{name}s(db)

@router.put("/{id}", response_model={Name}Response)
async def update(id: str, data: {Name}Update, db: AsyncSession = Depends(get_db)):
    return await update_{name}(db, id, data)

@router.delete("/{id}", status_code=204)
async def delete(id: str, db: AsyncSession = Depends(get_db)):
    await delete_{name}(db, id)
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

Write tests for each CRUD endpoint using `httpx.AsyncClient` and the test database fixture.

---

## Adding a New Frontend Page

Given a page name (e.g., `Projects`):

### 1. Page Component -- `frontend/src/routes/{Name}.tsx`

Create a React component with data fetching via React Query hooks. Include loading and error states.

### 2. Route Registration -- `frontend/src/App.tsx`

Add a `<Route path="/{name}s" element={<{Name} />} />` inside the router configuration.

### 3. API Client -- `frontend/src/api/{name}.ts`

```typescript
import { api } from './client';
import type { {Name}, {Name}Create, {Name}Update } from '../types/{name}';

export const {name}Api = {
  list: () => api.get<{Name}[]>('/{name}s'),
  get: (id: string) => api.get<{Name}>(`/{name}s/${id}`),
  create: (data: {Name}Create) => api.post<{Name}>('/{name}s', data),
  update: (id: string, data: {Name}Update) => api.put<{Name}>(`/{name}s/${id}`, data),
  delete: (id: string) => api.delete(`/{name}s/${id}`),
};
```

### 4. React Query Hooks -- `frontend/src/hooks/use{Name}.ts`

Create `use{Name}s()` for listing and `use{Name}(id)` for single item. Include `useMutation` hooks for create, update, delete with cache invalidation.

### 5. TypeScript Types -- `frontend/src/types/{name}.ts`

Define `{Name}`, `{Name}Create`, and `{Name}Update` interfaces matching the backend schemas.

### 6. Navigation

Add a `<NavLink to="/{name}s">{Name}s</NavLink>` in the sidebar or header component (check `Layout.tsx`).
