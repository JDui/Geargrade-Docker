from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine
from app.models import Device, Tag  # noqa: F401
from app.seed.sample_data import seed_sample_devices


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def seed_if_needed(session: Session, enabled: bool) -> None:
    if not enabled:
        return

    existing = session.scalar(select(Device.id).limit(1))
    if existing is None:
        seed_sample_devices(session)
