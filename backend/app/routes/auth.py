"""Authentication routes and dependencies.

This module provides a pluggable auth system. The `get_current_user`
dependency can be swapped between providers by changing AUTH_PROVIDER
in your environment configuration.

Supported providers:
- "custom": Local JWT validation using SECRET_KEY (default, fully functional)
- "clerk": Clerk.com JWT validation via JWKS (STUB — see instructions below)
- "auth0": Auth0 JWT validation via JWKS (STUB — see instructions below)

## Implementing Clerk or Auth0

The Clerk and Auth0 providers are **stubs** that demonstrate the integration
pattern. They currently fall back to HS256 validation against SECRET_KEY,
which will NOT work with real Clerk/Auth0 tokens (those use RS256 + JWKS).

To implement a real JWKS-based provider:

1. Install `PyJWKClient` support (already included in PyJWT[crypto]):
       from jwt import PyJWKClient
       jwks_client = PyJWKClient(settings.auth.jwks_url)

2. In the decode function, fetch the signing key:
       signing_key = jwks_client.get_signing_key_from_jwt(token)
       payload = jwt.decode(token, signing_key.key, algorithms=["RS256"], ...)

3. Cache the JWKS client (it handles caching internally).

See https://pyjwt.readthedocs.io/en/stable/usage.html#retrieve-rsa-signing-keys-from-a-jwks-endpoint
"""

from __future__ import annotations

from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Bearer token security scheme
bearer_scheme = HTTPBearer(auto_error=False)


class UserInfo(BaseModel):
    """Authenticated user information."""

    user_id: str
    email: str | None = None
    name: str | None = None
    provider: str
    raw_claims: dict[str, Any] = {}


def _decode_custom_jwt(token: str) -> dict[str, Any]:
    """Decode a JWT signed with the application SECRET_KEY."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        return payload
    except jwt.InvalidTokenError as exc:
        logger.warning("jwt_decode_failed", error=str(exc), provider="custom")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


def _decode_clerk_jwt(token: str) -> dict[str, Any]:
    """Decode a Clerk-issued JWT using JWKS.

    STUB IMPLEMENTATION — This currently validates with SECRET_KEY (HS256)
    which will NOT work with real Clerk tokens. See module docstring for
    implementation instructions.

    To implement:
        from jwt import PyJWKClient
        jwks_client = PyJWKClient(settings.auth.jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(token, signing_key.key, algorithms=["RS256"],
                             issuer=settings.auth.issuer)
    """
    if not settings.auth.jwks_url:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                "Clerk auth is not fully configured. "
                "Set AUTH__JWKS_URL and AUTH__ISSUER in .env, "
                "then implement JWKS validation in routes/auth.py. "
                "See the module docstring for instructions."
            ),
        )

    # TODO: Replace this block with JWKS validation (see docstring above)
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            issuer=settings.auth.issuer or None,
        )
        return payload
    except jwt.InvalidTokenError as exc:
        logger.warning("jwt_decode_failed", error=str(exc), provider="clerk")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


def _decode_auth0_jwt(token: str) -> dict[str, Any]:
    """Decode an Auth0-issued JWT using JWKS.

    STUB IMPLEMENTATION — This currently validates with SECRET_KEY (HS256)
    which will NOT work with real Auth0 tokens. See module docstring for
    implementation instructions.

    To implement:
        from jwt import PyJWKClient
        jwks_client = PyJWKClient(settings.auth.jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(token, signing_key.key, algorithms=["RS256"],
                             audience=settings.auth.audience,
                             issuer=settings.auth.issuer)
    """
    if not settings.auth.jwks_url:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                "Auth0 auth is not fully configured. "
                "Set AUTH__JWKS_URL, AUTH__ISSUER, and AUTH__AUDIENCE in .env, "
                "then implement JWKS validation in routes/auth.py. "
                "See the module docstring for instructions."
            ),
        )

    # TODO: Replace this block with JWKS validation (see docstring above)
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            audience=settings.auth.audience or None,
            issuer=settings.auth.issuer or None,
        )
        return payload
    except jwt.InvalidTokenError as exc:
        logger.warning("jwt_decode_failed", error=str(exc), provider="auth0")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> UserInfo:
    """Extract and validate the current user from the Authorization header.

    This dependency automatically routes to the correct JWT validation
    logic based on the configured AUTH_PROVIDER.

    Usage in routes:
        @router.get("/protected")
        async def protected_route(user: UserInfo = Depends(get_current_user)):
            return {"user_id": user.user_id}
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    provider = settings.AUTH_PROVIDER.lower()

    if provider == "clerk":
        claims = _decode_clerk_jwt(token)
    elif provider == "auth0":
        claims = _decode_auth0_jwt(token)
    else:
        claims = _decode_custom_jwt(token)

    # Extract user info from claims (field names vary by provider)
    user_id = claims.get("sub", claims.get("user_id", ""))
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    return UserInfo(
        user_id=user_id,
        email=claims.get("email"),
        name=claims.get("name"),
        provider=provider,
        raw_claims=claims,
    )


# Optional: dependency that allows unauthenticated access
async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> UserInfo | None:
    """Like get_current_user but returns None instead of raising 401."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


@router.post(
    "/me",
    response_model=UserInfo,
    summary="Get current user info",
)
async def get_me(user: UserInfo = Depends(get_current_user)) -> UserInfo:
    """Return the authenticated user's information.

    Requires a valid Bearer token in the Authorization header.
    The token is validated against the configured auth provider.
    """
    logger.info("user_info_requested", user_id=user.user_id, provider=user.provider)
    return user
