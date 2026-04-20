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
    BROKEN = "broken"


class RatingLabel(StrEnum):
    GOD = "god"
    EXCELLENT = "excellent"
    AVERAGE = "average"
    LOW = "low"


class MountSystemKey(StrEnum):
    NONE = "none"
    FE = "fe"
    E = "e"
    EF = "ef"
    EF_S = "ef_s"
    Z = "z"
    RF = "rf"
    X = "x"
    GFX = "gfx"
    L = "l"
    M43 = "m43"
    M42 = "m42"
    OTHER = "other"


class ImageSourceType(StrEnum):
    UPLOAD = "upload"
    CACHED_REMOTE = "cached_remote"


MOUNT_SYSTEM_LABELS = {
    MountSystemKey.NONE: "无",
    MountSystemKey.FE: "FE",
    MountSystemKey.E: "E",
    MountSystemKey.EF: "EF",
    MountSystemKey.EF_S: "EF-S",
    MountSystemKey.Z: "Z",
    MountSystemKey.RF: "RF",
    MountSystemKey.X: "X",
    MountSystemKey.GFX: "GFX",
    MountSystemKey.L: "L",
    MountSystemKey.M43: "M43",
    MountSystemKey.M42: "M42",
    MountSystemKey.OTHER: "其他",
}


def is_feeling_score(score: int) -> bool:
    return score == -1


def is_unrated_score(score: int) -> bool:
    return score == 0


def rating_label_from_score(score: int) -> RatingLabel | None:
    if is_feeling_score(score) or is_unrated_score(score):
        return None
    if score > 100:
        return RatingLabel.GOD
    if score >= 80:
        return RatingLabel.EXCELLENT
    if score >= 50:
        return RatingLabel.AVERAGE
    return RatingLabel.LOW


def mount_system_label_for(key: MountSystemKey | None, custom_value: str | None) -> str | None:
    if key is None:
        return None
    if key == MountSystemKey.OTHER:
        return custom_value or MOUNT_SYSTEM_LABELS[key]
    return MOUNT_SYSTEM_LABELS[key]
