from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


MotionMode = Literal["system", "on", "reduced"]
ContentWidth = Literal["compact", "default", "wide"]
DensityMode = Literal["comfortable", "compact"]
DefaultIconSize = Literal["small", "medium"]


class AppSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    simplified_mode: bool
    motion_mode: MotionMode
    content_width: ContentWidth
    density: DensityMode
    show_background_grid: bool
    default_icon_size: DefaultIconSize
    updated_at: datetime


class AppSettingsUpdate(BaseModel):
    simplified_mode: bool | None = None
    motion_mode: MotionMode | None = None
    content_width: ContentWidth | None = None
    density: DensityMode | None = None
    show_background_grid: bool | None = None
    default_icon_size: DefaultIconSize | None = None
