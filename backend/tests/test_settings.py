from app.api.routes.settings import _get_or_create_settings, update_app_settings
from app.schemas.settings import AppSettingsUpdate


def test_app_settings_are_persistent(session):
    initial = _get_or_create_settings(session)
    assert initial.simplified_mode is True

    update_app_settings(AppSettingsUpdate(simplified_mode=False, density="compact"), session)

    persisted = _get_or_create_settings(session)
    assert persisted.simplified_mode is False
    assert persisted.density == "compact"
