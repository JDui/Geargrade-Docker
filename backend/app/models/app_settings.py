from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    simplified_mode: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    motion_mode: Mapped[str] = mapped_column(String(16), default="system", nullable=False)
    content_width: Mapped[str] = mapped_column(String(16), default="default", nullable=False)
    density: Mapped[str] = mapped_column(String(16), default="comfortable", nullable=False)
    show_background_grid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    default_icon_size: Mapped[str] = mapped_column(String(16), default="small", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
