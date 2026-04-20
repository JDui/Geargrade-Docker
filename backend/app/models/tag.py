from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.device_tag import device_tags
from app.models.wishlist_device_tag import wishlist_device_tags


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)

    devices = relationship("Device", secondary=device_tags, back_populates="tags")
    wishlist_devices = relationship("WishlistDevice", secondary=wishlist_device_tags, back_populates="tags")
