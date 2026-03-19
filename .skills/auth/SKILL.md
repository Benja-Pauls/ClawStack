---
name: serpentstack-auth
description: "Understand and customize authentication in SerpentStack. Use when: adding auth to routes, swapping auth providers (Clerk, Auth0, custom SSO), or debugging auth issues."
---

# Auth

SerpentStack ships with working local JWT authentication (register, login, token validation). This skill explains the auth architecture and how to swap providers.

## How Auth Works (Built-in)

### Architecture

```
POST /api/v1/auth/register  →  UserService.register()  →  bcrypt hash  →  DB  →  JWT
POST /api/v1/auth/login     →  UserService.authenticate()  →  verify hash  →  JWT
GET  /api/v1/auth/me        →  get_current_user dependency  →  decode JWT  →  UserResponse

Any protected route:
    @router.delete("/{id}")
    async def delete(user: UserInfo = Depends(get_current_user)):
        # user.user_id, user.email available here
```

### Key Files

| File | Role |
|---|---|
| `backend/app/routes/auth.py` | Auth routes + `get_current_user` dependency |
| `backend/app/services/user.py` | Registration, authentication, password hashing |
| `backend/app/models/user.py` | User SQLAlchemy model (email, hashed_password) |
| `backend/app/schemas/user.py` | Request/response schemas (register, login, token) |
| `backend/app/middleware/auth.py` | Optional global auth middleware (not enabled by default) |

### The `UserInfo` Contract

All protected routes receive a `UserInfo` object via dependency injection:

```python
class UserInfo(BaseModel):
    user_id: str
    email: str | None = None
    name: str | None = None
    raw_claims: dict[str, Any] = {}
```

**This is the interface between auth and the rest of the app.** When swapping providers, keep this shape — every route that uses `Depends(get_current_user)` depends on it.

## Protecting a Route

Add `Depends(get_current_user)` to any route that requires authentication:

```python
from app.routes.auth import UserInfo, get_current_user

@router.post("")
async def create_thing(
    payload: ThingCreate,
    user: UserInfo = Depends(get_current_user),  # ← requires valid JWT
    db: AsyncSession = Depends(get_db),
    service: ThingService = Depends(get_thing_service),
) -> ThingResponse:
    thing = await service.create(payload, owner_id=user.user_id)
    await db.commit()
    return ThingResponse.model_validate(thing)
```

For optional auth (authenticated if token present, anonymous otherwise):

```python
from app.routes.auth import get_optional_user

@router.get("")
async def list_things(
    user: UserInfo | None = Depends(get_optional_user),
) -> list[ThingResponse]:
    # user is None if no token, UserInfo if authenticated
    ...
```

## Swapping to an External Provider

To replace the built-in JWT auth with Clerk, Auth0, or another provider:

### Step 1: Replace `get_current_user` in `routes/auth.py`

The **only function you need to change** is `get_current_user`. Replace JWT decode with your provider's token validation:

**For Clerk** — see [Clerk FastAPI guide](https://clerk.com/docs/references/fastapi/overview):
```python
from jwt import PyJWKClient

jwks_client = PyJWKClient("https://your-clerk-domain/.well-known/jwks.json")

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> UserInfo:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    payload = jwt.decode(token, signing_key.key, algorithms=["RS256"])

    return UserInfo(
        user_id=payload["sub"],
        email=payload.get("email"),
        name=payload.get("name"),
        raw_claims=payload,
    )
```

**For Auth0** — see [Auth0 FastAPI guide](https://auth0.com/docs/quickstart/backend/python/01-authorization):
```python
jwks_client = PyJWKClient("https://your-tenant.auth0.com/.well-known/jwks.json")

async def get_current_user(...) -> UserInfo:
    # Same pattern, add audience validation:
    payload = jwt.decode(
        token, signing_key.key, algorithms=["RS256"],
        audience="your-api-audience",
        issuer="https://your-tenant.auth0.com/",
    )
    return UserInfo(user_id=payload["sub"], email=payload.get("email"), ...)
```

### Step 2: Remove unused files (optional)

If you no longer need local registration/login:
- Remove `backend/app/services/user.py`
- Remove `backend/app/models/user.py` (and its import in `models/__init__.py`)
- Remove `backend/app/schemas/user.py`
- Remove the `/register` and `/login` routes from `routes/auth.py`
- Remove `passlib[bcrypt]` from `pyproject.toml`

### Step 3: Update environment variables

Add your provider's config to `.env`:
```bash
# For Clerk:
CLERK_JWKS_URL=https://your-clerk-domain/.well-known/jwks.json

# For Auth0:
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=your-api-audience
```

### What stays the same

- `UserInfo` shape — all routes keep working
- `Depends(get_current_user)` pattern — no route changes needed
- `get_optional_user` — works with any provider
- Frontend token storage pattern — still sends `Authorization: Bearer <token>`

## Testing Auth

```bash
# Register a user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Use the token
TOKEN="<access_token from login response>"
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Protected route (delete item)
curl -X DELETE http://localhost:8000/api/v1/items/<item-id> \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| 401 on every request | Missing or malformed `Authorization: Bearer <token>` header | Check header format, ensure token isn't expired |
| 422 on register | Password too short or invalid email | Password must be ≥8 chars, email must be valid |
| 409 on register | Email already taken | Use a different email or login instead |
| `jwt.InvalidTokenError` in logs | Token signed with wrong key or expired | Check `SECRET_KEY` matches between token creation and validation |
