from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.device import Device
from app.seed.sample_data import seed_sample_devices


router = APIRouter(prefix="/bootstrap", tags=["bootstrap"])


@router.post("/sample-data")
def bootstrap_sample_data(db: Session = Depends(get_db)) -> dict[str, str]:
    existing = db.scalar(select(Device.id).limit(1))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Database already contains devices.")
    seed_sample_devices(db)
    return {"message": "Sample data created."}
