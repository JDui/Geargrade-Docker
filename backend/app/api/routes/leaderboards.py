from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.device import SortOrder
from app.schemas.leaderboard import (
    FinanceLeaderboardResponse,
    HoldingDurationResponse,
    ScoreLeaderboardResponse,
)
from app.services.leaderboard_service import (
    get_finance_leaderboard,
    get_holding_duration_leaderboard,
    get_score_leaderboard,
)


router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])


@router.get("/holding-duration", response_model=HoldingDurationResponse)
def holding_duration_leaderboard(
    sort_order: SortOrder = Query(default="desc"),
    db: Session = Depends(get_db),
) -> HoldingDurationResponse:
    return get_holding_duration_leaderboard(db, sort_order=sort_order)


@router.get("/score", response_model=ScoreLeaderboardResponse)
def score_leaderboard(
    sort_order: SortOrder = Query(default="desc"),
    db: Session = Depends(get_db),
) -> ScoreLeaderboardResponse:
    return get_score_leaderboard(db, sort_order=sort_order)


@router.get("/finance", response_model=FinanceLeaderboardResponse)
def finance_leaderboard(
    sort_order: SortOrder = Query(default="desc"),
    db: Session = Depends(get_db),
) -> FinanceLeaderboardResponse:
    return get_finance_leaderboard(db, sort_order=sort_order)
