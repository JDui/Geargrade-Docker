from enum import StrEnum


class DeviceCategory(StrEnum):
    CAMERA_BODY = "camera_body"
    LENS = "lens"
    ACTION_CAMERA = "action_camera"
    DRONE = "drone"
    ACCESSORY = "accessory"
    OTHER = "other"


class DeviceStatus(StrEnum):
    HOLDING = "holding"
    FOR_SALE = "for_sale"
    SOLD = "sold"
    ARCHIVED = "archived"
    PENDING = "pending"
    BROKEN = "broken"


class DeviceRating(StrEnum):
    GOD = "god"
    EXCELLENT = "excellent"
    AVERAGE = "average"
    LOW = "low"
    SPECIAL = "special"


class ImageSourceType(StrEnum):
    UPLOAD = "upload"
    CACHED_REMOTE = "cached_remote"
