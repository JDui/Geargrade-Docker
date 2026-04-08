from sqlalchemy import func, select

from app.models.device import Device
from app.seed.sample_data import seed_sample_devices


def test_seed_sample_devices(session):
    seed_sample_devices(session)
    total = session.scalar(select(func.count(Device.id)))
    assert total == 6
