from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import DeviceStatus, rating_label_from_score
from app.models.device import Device
from app.schemas.device import SortOrder
from app.schemas.leaderboard import (
    FinanceLeaderboardItem,
    FinanceLeaderboardResponse,
    HoldingDurationItem,
    HoldingDurationResponse,
    ScoreLeaderboardItem,
    ScoreLeaderboardResponse,
)


ACTIVE_STATUSES = {DeviceStatus.HOLDING, DeviceStatus.FOR_SALE}


def _rank_items(items):
    for index, item in enumerate(items, 1):
        item.rank = index
    return items


def get_holding_duration_leaderboard(session: Session, sort_order: SortOrder = "desc") -> HoldingDurationResponse:
    today = date.today()
    devices = session.scalars(select(Device).where(Device.purchase_date.is_not(None))).all()
    items: list[HoldingDurationItem] = []

    for device in devices:
        end_date = today if device.status in ACTIVE_STATUSES else device.sale_date
        if end_date is None or device.purchase_date is None:
            continue
        duration_days = max((end_date - device.purchase_date).days, 0)
        items.append(
            HoldingDurationItem(
                rank=0,
                device_id=device.id,
                name=device.name,
                brand=device.brand,
                score=device.score,
                rating_label=rating_label_from_score(device.score),
                duration_days=duration_days,
                purchase_date=device.purchase_date.isoformat() if device.purchase_date else None,
                sale_date=device.sale_date.isoformat() if device.sale_date else None,
            )
        )

    if sort_order == "desc":
        items.sort(key=lambda item: (-item.duration_days, -item.score, item.name.lower()))
    else:
        items.sort(key=lambda item: (item.duration_days, item.score, item.name.lower()))
    return HoldingDurationResponse(items=_rank_items(items))


def get_score_leaderboard(session: Session, sort_order: SortOrder = "desc") -> ScoreLeaderboardResponse:
    devices = session.scalars(select(Device).where(Device.score >= 0)).all()
    if sort_order == "desc":
        devices = sorted(
            devices,
            key=lambda device: (-device.score, -(device.updated_at.timestamp() if device.updated_at else 0), device.name.lower()),
        )
    else:
        devices = sorted(
            devices,
            key=lambda device: (device.score, device.updated_at.timestamp() if device.updated_at else 0, device.name.lower()),
        )
    items = [
        ScoreLeaderboardItem(
            rank=index,
            device_id=device.id,
            name=device.name,
            brand=device.brand,
            score=device.score,
            rating_label=rating_label_from_score(device.score),
        )
        for index, device in enumerate(devices, 1)
    ]
    return ScoreLeaderboardResponse(items=items)


def get_finance_leaderboard(session: Session, sort_order: SortOrder = "desc") -> FinanceLeaderboardResponse:
    devices = session.scalars(
        select(Device).where(
            Device.status == DeviceStatus.SOLD,
            Device.purchase_price.is_not(None),
            Device.sale_price.is_not(None),
        )
    ).all()

    items = [
        FinanceLeaderboardItem(
            rank=0,
            device_id=device.id,
            name=device.name,
            brand=device.brand,
            score=device.score,
            rating_label=rating_label_from_score(device.score),
            profit_value=float(device.sale_price or 0) - float(device.purchase_price or 0),
            purchase_price=device.purchase_price,
            sale_price=device.sale_price,
        )
        for device in devices
    ]

    if sort_order == "desc":
        items.sort(key=lambda item: (-item.profit_value, -item.score, item.name.lower()))
    else:
        items.sort(key=lambda item: (item.profit_value, item.score, item.name.lower()))
    return FinanceLeaderboardResponse(items=_rank_items(items))
