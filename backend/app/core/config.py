from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Geargrade"
    api_v1_prefix: str = "/api/v1"
    app_env: str = "development"
    database_url: str = "sqlite:///./data/geargrade.db"
    media_root: Path = Path("./data/media")
    media_url_prefix: str = "/media"
    seed_sample_data: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.media_root.mkdir(parents=True, exist_ok=True)
    (settings.media_root / "uploads").mkdir(parents=True, exist_ok=True)
    (settings.media_root / "remote-cache").mkdir(parents=True, exist_ok=True)
    return settings
