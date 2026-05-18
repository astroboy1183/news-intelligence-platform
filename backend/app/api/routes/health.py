from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import engine

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health() -> dict[str, str | bool]:
    db_ok = False
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
    }
