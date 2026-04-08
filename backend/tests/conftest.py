from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models import Device, Tag  # noqa: F401


@pytest.fixture()
def session(tmp_path: Path) -> Generator[Session, None, None]:
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        yield db

    Base.metadata.drop_all(bind=engine)
