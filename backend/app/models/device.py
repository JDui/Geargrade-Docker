from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import DeviceCategory, DeviceStatus, ImageSourceType, MountSystemKey
from app.db.base import Base
from app.models.device_tag import device_tags


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    brand: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[DeviceCategory] = mapped_column(Enum(DeviceCategory, native_enum=False), index=True)
    mount_system_key: Mapped[MountSystemKey | None] = mapped_column(
        Enum(MountSystemKey, native_enum=False),
        nullable=True,
    )
    mount_system_custom: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[DeviceStatus] = mapped_column(Enum(DeviceStatus, native_enum=False), index=True)
    score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    acquisition_iteration: Mapped[int] = mapped_column(Integer, default=1)
    pros: Mapped[list[str]] = mapped_column(JSON, default=list)
    cons: Mapped[list[str]] = mapped_column(JSON, default=list)
    review_detail: Mapped[str] = mapped_column(Text, default="")
    purchase_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    sale_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sale_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    image_source_type: Mapped[ImageSourceType | None] = mapped_column(
        Enum(ImageSourceType, native_enum=False),
        nullable=True,
    )
    image_original_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_storage_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    tags = relationship("Tag", secondary=device_tags, back_populates="devices", lazy="selectin")
