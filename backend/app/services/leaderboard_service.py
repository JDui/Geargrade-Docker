from datetime import date
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import DeviceCategory, DeviceStatus, rating_label_from_score
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
from app.services.device_service import _score_ranking_key, calculate_daily_cost_value


ACTIVE_STATUSES = {DeviceStatus.HOLDING, DeviceStatus.FOR_SALE}
DurationUnit = Literal["days", "months"]


def _rank_items(items):
    for index, item in enumerate(items, 1):
        item.rank = index
    return items


def _calendar_month_delta(start_date: date, end_date: date) -> int:
    return max((end_date.year - start_date.year) * 12 + end_date.month - start_date.month, 0)


def _category_filter(category: DeviceCategory | None):
    return [] if category is None else [Device.category == category]


def get_holding_duration_leaderboard(
    session: Session,
    sort_order: SortOrder = "desc",
    duration_unit: DurationUnit = "days",
    category: DeviceCategory | None = None,
) -> HoldingDurationResponse:
    today = date.today()
    devices = session.scalars(
        select(Device)
        .where(Device.purchase_date.is_not(None), *_category_filter(category))
    ).all()
    items: list[HoldingDurationItem] = []

    for device in devices:
        end_date = today if device.status in ACTIVE_STATUSES else device.sale_date
        if end_date is None or device.purchase_date is None:
            continue
        duration_days = max((end_date - device.purchase_date).days, 0)
        duration_months = _calendar_month_delta(device.purchase_date, end_date)
        items.append(
            HoldingDurationItem(
                rank=0,
                device_id=device.id,
                name=device.name,
                brand=device.brand,
                score=device.score,
                rating_label=rating_label_from_score(device.score),
                daily_cost_value=calculate_daily_cost_value(
                    device.status,
                    device.purchase_price,
                    device.purchase_date,
                    device.sale_price,
                    device.sale_date,
                ),
                duration_days=duration_days,
                duration_months=duration_months,
                purchase_date=device.purchase_date.isoformat() if device.purchase_date else None,
                sale_date=device.sale_date.isoformat() if device.sale_date else None,
            )
        )

    if duration_unit == "months" and sort_order == "desc":
        items.sort(key=lambda item: (-item.duration_months, -item.duration_days, -item.score, item.name.lower()))
    elif duration_unit == "months":
        items.sort(key=lambda item: (item.duration_months, item.duration_days, item.score, item.name.lower()))
    elif sort_order == "desc":
        items.sort(key=lambda item: (-item.duration_days, -item.score, item.name.lower()))
    else:
        items.sort(key=lambda item: (item.duration_days, item.score, item.name.lower()))
    return HoldingDurationResponse(items=_rank_items(items))


def get_score_leaderboard(
    session: Session,
    sort_order: SortOrder = "desc",
    category: DeviceCategory | None = None,
) -> ScoreLeaderboardResponse:
    devices = session.scalars(
        select(Device).where(Device.score > 0, *_category_filter(category))
    ).all()
    if sort_order == "desc":
        devices = sorted(devices, key=_score_ranking_key)
    else:
        devices = sorted(
            devices,
            key=lambda device: (-_score_ranking_key(device)[0], -_score_ranking_key(device)[1], _score_ranking_key(device)[2]),
        )
    items = [
        ScoreLeaderboardItem(
            rank=index,
            device_id=device.id,
            name=device.name,
            brand=device.brand,
            score=device.score,
            rating_label=rating_label_from_score(device.score),
            daily_cost_value=calculate_daily_cost_value(
                device.status,
                device.purchase_price,
                device.purchase_date,
                device.sale_price,
                device.sale_date,
            ),
        )
        for index, device in enumerate(devices, 1)
    ]
    return ScoreLeaderboardResponse(items=items)


def get_finance_leaderboard(
    session: Session,
    sort_order: SortOrder = "desc",
    category: DeviceCategory | None = None,
) -> FinanceLeaderboardResponse:
    devices = session.scalars(
        select(Device).where(
            Device.status == DeviceStatus.SOLD,
            Device.purchase_price.is_not(None),
            Device.sale_price.is_not(None),
            *_category_filter(category),
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
            daily_cost_value=calculate_daily_cost_value(
                device.status,
                device.purchase_price,
                device.purchase_date,
                device.sale_price,
                device.sale_date,
            ),
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
