"""Allow running CLI commands via python -m app.cli."""

from __future__ import annotations

import sys


def main() -> None:
    print("Available CLI commands:")
    print("  python -m app.cli.seed    Seed the database with sample data")
    sys.exit(0)


if __name__ == "__main__":
    main()
