from sqlalchemy import Column, ForeignKey, Integer, Table

from app.db.base import Base


wishlist_device_tags = Table(
    "wishlist_device_tags",
    Base.metadata,
    Column("wishlist_device_id", Integer, ForeignKey("wishlist_devices.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
