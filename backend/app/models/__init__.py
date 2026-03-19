"""SQLAlchemy model registry.

Import all models here so Alembic's autogenerate can detect them.
When adding a new model, add an import line below.
"""

from app.models.item import Item  # noqa: F401
from app.models.user import User  # noqa: F401
