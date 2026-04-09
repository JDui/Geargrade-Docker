from sqlalchemy.orm import Session

from app.core.enums import DeviceCategory, DeviceStatus, MountSystemKey
from app.schemas.device import DeviceCreate
from app.services.device_service import create_device


SAMPLE_DEVICES = [
    DeviceCreate(
        name="Fujifilm X-T5",
        brand="Fujifilm",
        category=DeviceCategory.CAMERA_BODY,
        mount_system_key=MountSystemKey.X,
        status=DeviceStatus.HOLDING,
        score=103,
        acquisition_iteration=1,
        pros=["复古外形", "4000 万像素", "机身防抖强"],
        cons=["视频规格一般", "价格偏高"],
        review_detail="静态摄影体验很强，色彩和直出都稳定，旅行和日常拍摄都很顺手。",
        tags=["旗舰", "旅行", "收藏"],
        purchase_price=12500,
        purchase_date="2023-10-01",
    ),
    DeviceCreate(
        name="Sony FE 35mm F1.4 GM",
        brand="Sony",
        category=DeviceCategory.LENS,
        mount_system_key=MountSystemKey.FE,
        status=DeviceStatus.HOLDING,
        score=92,
        acquisition_iteration=1,
        pros=["锐度强", "体积控制好", "对焦快"],
        cons=["价格不低"],
        review_detail="工作和个人拍摄都能覆盖，是我最省心的一支 35 定焦。",
        tags=["定焦", "挂机", "人文"],
        purchase_price=7600,
        purchase_date="2024-02-12",
    ),
    DeviceCreate(
        name="DJI Air 3",
        brand="DJI",
        category=DeviceCategory.DRONE,
        status=DeviceStatus.FOR_SALE,
        score=75,
        acquisition_iteration=1,
        pros=["续航优秀", "避障稳定"],
        cons=["出勤率偏低"],
        review_detail="成像和飞行体验不错，但我的题材不太依赖航拍，准备出售。",
        tags=["航拍", "待售"],
        purchase_price=8200,
        purchase_date="2024-06-18",
    ),
    DeviceCreate(
        name="GoPro Hero 12",
        brand="GoPro",
        category=DeviceCategory.ACTION_CAMERA,
        status=DeviceStatus.SOLD,
        score=46,
        acquisition_iteration=1,
        pros=["防抖强", "配件多"],
        cons=["续航一般", "室内画质一般"],
        review_detail="旅游时偶尔有用，但整体使用场景过少，已经售出。",
        tags=["运动相机", "已售"],
        purchase_price=2800,
        sale_price=2100,
        purchase_date="2023-05-08",
        sale_date="2024-09-20",
    ),
    DeviceCreate(
        name="Peak Design Slide",
        brand="Peak Design",
        category=DeviceCategory.ACCESSORY,
        status=DeviceStatus.HOLDING,
        score=88,
        acquisition_iteration=2,
        pros=["快拆方便", "负重舒适"],
        cons=["价格偏高"],
        review_detail="所有主力机身都想配一条，虽然不便宜但使用体验稳定。",
        tags=["背带", "高频使用"],
        purchase_price=450,
        purchase_date="2022-12-11",
    ),
    DeviceCreate(
        name="Contax T2",
        brand="Contax",
        category=DeviceCategory.CAMERA_BODY,
        mount_system_key=MountSystemKey.NONE,
        status=DeviceStatus.BROKEN,
        score=-1,
        acquisition_iteration=3,
        pros=["外观经典", "收藏价值高"],
        cons=["维修难", "价格虚高"],
        review_detail="这类设备的意义更多是把玩和收藏，不适合只看性价比。",
        tags=["胶片", "收藏", "正在感受"],
        purchase_price=9800,
        purchase_date="2021-03-05",
    ),
]


def seed_sample_devices(session: Session) -> None:
    for sample in SAMPLE_DEVICES:
        create_device(session, sample, settings=None)
