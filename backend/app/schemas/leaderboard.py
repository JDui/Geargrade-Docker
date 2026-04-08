from pydantic import BaseModel

from app.core.enums import RatingLabel


class LeaderboardBaseItem(BaseModel):
    rank: int
    device_id: int
    name: str
    brand: str
    score: int
    rating_label: RatingLabel | None


class HoldingDurationItem(LeaderboardBaseItem):
    duration_days: int
    purchase_date: str | None
    sale_date: str | None


class ScoreLeaderboardItem(LeaderboardBaseItem):
    pass


class FinanceLeaderboardItem(LeaderboardBaseItem):
    profit_value: float
    purchase_price: float | None
    sale_price: float | None


class HoldingDurationResponse(BaseModel):
    items: list[HoldingDurationItem]


class ScoreLeaderboardResponse(BaseModel):
    items: list[ScoreLeaderboardItem]


class FinanceLeaderboardResponse(BaseModel):
    items: list[FinanceLeaderboardItem]
