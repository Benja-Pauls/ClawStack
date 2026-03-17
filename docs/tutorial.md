# Tutorial: Build Your First Feature

This tutorial walks you through adding a complete **Notes** feature to ClawStack — from database model to API endpoint to frontend page. By the end, you'll have a working Notes CRUD interface and a clear understanding of the patterns you'll repeat for every feature you build.

**Time:** ~15 minutes

**Prerequisites:** You've run `make init`, `make setup`, and `make dev`. The app is running at http://localhost:5173.

---

## What You'll Build

A Notes resource with:
- SQLAlchemy model with UUID primary key
- Alembic migration
- Pydantic request/response schemas
- Service layer with business logic
- FastAPI route with full CRUD
- Backend test
- React page with create/list/delete
- React Query hook for data fetching
- Route wired into the app

The full vertical slice — everything ClawStack's `Item` example demonstrates, rebuilt from scratch for a new resource.

---

## Step 1: Create the Model

Create `backend/app/models/note.py`:

```python
"""Note SQLAlchemy model."""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Note(Base):
    """A simple note with a title and body."""

    __tablename__ = "notes"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**What's happening:** The model inherits from `Base`, which gives it `id` (UUID), `created_at`, and `updated_at` automatically. You only define the columns specific to your resource.

Register the model so Alembic can detect it. Edit `backend/app/models/__init__.py`:

```python
from app.models.item import Item  # noqa: F401
from app.models.note import Note  # noqa: F401
```

---

## Step 2: Create the Migration

```bash
make migrate-new name="add_notes_table"
```

This generates a migration file in `backend/migrations/versions/`. Open it and verify it creates the `notes` table with the columns you expect. Then apply it:

```bash
make migrate
```

Check that the table exists:

```bash
docker compose exec postgres psql -U clawstack -d clawstack -c "\dt notes"
```

---

## Step 3: Create Pydantic Schemas

Create `backend/app/schemas/note.py`:

```python
"""Note request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    """Schema for creating a new note."""

    title: str = Field(min_length=1, max_length=255, description="Note title")
    body: str | None = Field(default=None, description="Note body text")


class NoteUpdate(BaseModel):
    """Schema for updating a note. All fields are optional."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = None


class NoteResponse(BaseModel):
    """Schema for note responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str | None
    created_at: datetime
    updated_at: datetime


class NoteListResponse(BaseModel):
    """Paginated list of notes."""

    notes: list[NoteResponse]
    total: int
    skip: int
    limit: int
```

**Pattern:** `Create` for POST bodies, `Update` for PUT bodies (all fields optional), `Response` for what the API returns, `ListResponse` for paginated lists. This mirrors the `Item` schemas exactly.

---

## Step 4: Create the Service Layer

Create `backend/app/services/note.py`:

```python
"""Note service layer."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.logging_config import get_logger
from app.models.note import Note
from app.schemas.note import NoteCreate, NoteUpdate

logger = get_logger(__name__)


class NoteService:
    """Service for note CRUD operations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_notes(self, skip: int = 0, limit: int = 20) -> list[Note]:
        stmt = select(Note).order_by(Note.created_at.desc()).offset(skip).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    def count_notes(self) -> int:
        stmt = select(func.count()).select_from(Note)
        result = self.db.execute(stmt).scalar()
        return result or 0

    def get_note(self, note_id: uuid.UUID) -> Note | None:
        stmt = select(Note).where(Note.id == note_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def create_note(self, data: NoteCreate) -> Note:
        note = Note(title=data.title, body=data.body)
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        logger.info("note_created", note_id=str(note.id), title=note.title)
        return note

    def update_note(self, note_id: uuid.UUID, data: NoteUpdate) -> Note | None:
        note = self.get_note(note_id)
        if note is None:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(note, field, value)
        self.db.commit()
        self.db.refresh(note)
        return note

    def delete_note(self, note_id: uuid.UUID) -> bool:
        note = self.get_note(note_id)
        if note is None:
            return False
        self.db.delete(note)
        self.db.commit()
        return True
```

**Pattern:** Services own all database logic. Routes are thin wrappers that validate input, call the service, and return responses. This keeps business logic testable without HTTP.

---

## Step 5: Create the Route

Create `backend/app/routes/notes.py`:

```python
"""Notes CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.logging_config import get_logger
from app.models.base import get_db
from app.schemas.note import NoteCreate, NoteListResponse, NoteResponse, NoteUpdate
from app.services.note import NoteService

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/notes", tags=["notes"])


def get_note_service(db: Session = Depends(get_db)) -> NoteService:
    return NoteService(db)


@router.get("", response_model=NoteListResponse)
def list_notes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    service: NoteService = Depends(get_note_service),
) -> NoteListResponse:
    notes = service.list_notes(skip=skip, limit=limit)
    total = service.count_notes()
    return NoteListResponse(
        notes=[NoteResponse.model_validate(n) for n in notes],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    payload: NoteCreate,
    service: NoteService = Depends(get_note_service),
) -> NoteResponse:
    note = service.create_note(payload)
    return NoteResponse.model_validate(note)


@router.get("/{note_id}", response_model=NoteResponse)
def get_note(
    note_id: uuid.UUID,
    service: NoteService = Depends(get_note_service),
) -> NoteResponse:
    note = service.get_note(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail=f"Note {note_id} not found")
    return NoteResponse.model_validate(note)


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: uuid.UUID,
    payload: NoteUpdate,
    service: NoteService = Depends(get_note_service),
) -> NoteResponse:
    note = service.update_note(note_id, payload)
    if note is None:
        raise HTTPException(status_code=404, detail=f"Note {note_id} not found")
    return NoteResponse.model_validate(note)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: uuid.UUID,
    service: NoteService = Depends(get_note_service),
) -> None:
    if not service.delete_note(note_id):
        raise HTTPException(status_code=404, detail=f"Note {note_id} not found")
```

**Key pattern:** Route handlers are `def`, not `async def`, because we use synchronous SQLAlchemy. FastAPI runs sync handlers in a threadpool automatically.

Register the router in `backend/app/main.py`. Add the import and include:

```python
from app.routes import auth, health, items, notes  # add notes

# In create_app():
application.include_router(notes.router)  # add this line
```

---

## Step 6: Test the Backend

Create `backend/tests/test_notes.py`:

```python
"""Tests for notes CRUD endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_notes_crud_lifecycle(client: TestClient) -> None:
    """Test full CRUD lifecycle for notes."""
    # Create
    resp = client.post("/api/v1/notes", json={"title": "My Note", "body": "Hello world"})
    assert resp.status_code == 201
    note = resp.json()
    note_id = note["id"]
    assert note["title"] == "My Note"
    assert note["body"] == "Hello world"

    # Read
    resp = client.get(f"/api/v1/notes/{note_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "My Note"

    # Update
    resp = client.put(f"/api/v1/notes/{note_id}", json={"title": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"
    assert resp.json()["body"] == "Hello world"  # unchanged

    # List
    resp = client.get("/api/v1/notes")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1

    # Delete
    resp = client.delete(f"/api/v1/notes/{note_id}")
    assert resp.status_code == 204

    # Verify deleted
    resp = client.get(f"/api/v1/notes/{note_id}")
    assert resp.status_code == 404


def test_create_note_validation(client: TestClient) -> None:
    """Empty title should return 422."""
    resp = client.post("/api/v1/notes", json={"title": ""})
    assert resp.status_code == 422
```

Run the tests:

```bash
cd backend && uv run pytest tests/test_notes.py -v
```

You should see both tests pass.

---

## Step 7: Add the Frontend Type

Add the Note types to `frontend/src/types/note.ts`:

```typescript
export interface Note {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteListResponse {
  notes: Note[];
  total: number;
  skip: number;
  limit: number;
}

export interface NoteCreate {
  title: string;
  body?: string | null;
}
```

---

## Step 8: Add the API Client

Create `frontend/src/api/notes.ts`:

```typescript
import { apiRequest } from "./client";
import type { Note, NoteListResponse, NoteCreate } from "@/types/note";

export async function getNotes(): Promise<NoteListResponse> {
  return apiRequest<NoteListResponse>("/notes");
}

export async function createNote(data: NoteCreate): Promise<Note> {
  return apiRequest<Note>("/notes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteNote(id: string): Promise<void> {
  return apiRequest<void>(`/notes/${id}`, {
    method: "DELETE",
  });
}
```

---

## Step 9: Add the React Query Hook

Create `frontend/src/hooks/useNotes.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotes, createNote, deleteNote } from "@/api/notes";
import type { NoteCreate, NoteListResponse } from "@/types/note";

const NOTES_KEY = ["notes"] as const;

export function useNotes() {
  return useQuery<NoteListResponse>({
    queryKey: NOTES_KEY,
    queryFn: getNotes,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NoteCreate) => createNote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_KEY });
    },
  });
}
```

---

## Step 10: Add the Page Component

Create `frontend/src/routes/Notes.tsx`:

```tsx
import { useState } from "react";
import { useNotes, useCreateNote, useDeleteNote } from "@/hooks/useNotes";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function Notes() {
  const { data, isLoading, error } = useNotes();
  const notes = data?.notes;
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createNote.mutate(
      { title: title.trim(), body: body.trim() || null },
      { onSuccess: () => { setTitle(""); setBody(""); } },
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notes</h1>
        <p className="mt-1 text-muted-foreground">Your notes collection.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-surface-raised p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-foreground">New Note</h2>
        <div className="grid gap-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label htmlFor="body" className="mb-1 block text-sm font-medium text-foreground">
              Body
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your note..."
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button type="submit" disabled={createNote.isPending || !title.trim()}>
            {createNote.isPending ? "Creating..." : "Create Note"}
          </Button>
        </div>
      </form>

      {isLoading && <LoadingSpinner className="py-12" />}

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-6 text-center">
          <p className="text-danger">Failed to load notes.</p>
        </div>
      )}

      {notes && notes.length === 0 && (
        <div className="rounded-xl border border-border bg-surface-raised p-12 text-center">
          <p className="text-muted-foreground">No notes yet. Create one above.</p>
        </div>
      )}

      {notes && notes.length > 0 && (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-border bg-surface-raised p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{note.title}</h3>
                  {note.body && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {note.body}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => deleteNote.mutate(note.id)}
                  disabled={deleteNote.isPending}
                  className="ml-4 text-xs"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 11: Wire Up the Route

Edit `frontend/src/App.tsx` to add the Notes route:

```tsx
import Notes from "@/routes/Notes";

// Inside <Routes>:
<Route path="/notes" element={<Notes />} />
```

Add a navigation link in `frontend/src/components/Layout.tsx`. Find the nav links section and add:

```tsx
<NavLink to="/notes">Notes</NavLink>
```

---

## Step 12: See It Work

Your dev servers are already running (`make dev`). Open http://localhost:5173/notes in your browser.

1. Create a note with a title and body
2. See it appear in the list
3. Delete it
4. Check the backend structured logs in your terminal — you'll see `note_created` events with the note ID

That's the full loop. Open http://localhost:8000/api/docs to see the auto-generated OpenAPI docs for your new `/api/v1/notes` endpoints.

---

## The Pattern

Every feature in ClawStack follows this same structure:

```
backend/app/models/{resource}.py       # SQLAlchemy model
backend/app/schemas/{resource}.py      # Pydantic schemas
backend/app/services/{resource}.py     # Business logic
backend/app/routes/{resource}.py       # API endpoints
backend/tests/test_{resource}.py       # Tests
frontend/src/types/{resource}.ts       # TypeScript types
frontend/src/api/{resource}.ts         # API client functions
frontend/src/hooks/use{Resource}.ts    # React Query hooks
frontend/src/routes/{Resource}.tsx     # Page component
```

The `scaffold` OpenClaw skill automates this entire process — it creates all nine files, wires up the route, and registers the router. But now you know exactly what it's generating and why.

---

## Next Steps

- **Add authentication:** Protect the notes endpoints with `Depends(get_current_user)` from `routes/auth.py`
- **Add relationships:** Create a foreign key from notes to a user model
- **Deploy it:** Run `make deploy` to ship to AWS
- **Customize the frontend:** Edit the Tailwind theme in `frontend/src/index.css`
