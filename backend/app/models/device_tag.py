from sqlalchemy import Column, ForeignKey, Integer, Table

from app.db.base import Base


device_tags = Table(
    "device_tags",
    Base.metadata,
    Column("device_id", Integer, ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
