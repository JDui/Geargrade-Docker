from sqlalchemy import text, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine
from app.models import Device, Tag, WishlistDevice  # noqa: F401
from app.seed.sample_data import seed_sample_devices


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_legacy_wishlist_status()


def _migrate_legacy_wishlist_status() -> None:
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as connection:
        columns = connection.execute(text("PRAGMA table_info(wishlist_devices)")).mappings().all()
        if not any(column["name"] == "status" for column in columns):
            return

        preserved_columns = [column["name"] for column in columns if column["name"] != "status"]
        column_list = ", ".join(preserved_columns)
        indexes = connection.execute(
            text("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'wishlist_devices'")
        ).scalars().all()

        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text("ALTER TABLE wishlist_devices RENAME TO wishlist_devices_legacy"))
        for index_name in indexes:
            connection.execute(text(f'DROP INDEX IF EXISTS "{index_name}"'))
        Base.metadata.tables["wishlist_devices"].create(bind=connection)
        connection.execute(
            text(
                f"INSERT INTO wishlist_devices ({column_list}) "
                f"SELECT {column_list} FROM wishlist_devices_legacy"
            )
        )
        connection.execute(text("DROP TABLE wishlist_devices_legacy"))
        connection.execute(text("PRAGMA foreign_keys=ON"))


def seed_if_needed(session: Session, enabled: bool) -> None:
    if not enabled:
        return

    existing = session.scalar(select(Device.id).limit(1))
    if existing is None:
        seed_sample_devices(session)
