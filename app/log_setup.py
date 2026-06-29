import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.config import LOGS_DIR


def setup_logging() -> dict[str, logging.Logger]:
    log_dir = Path(LOGS_DIR)
    log_dir.mkdir(parents=True, exist_ok=True)

    loggers = {}

    for name in ("server", "execution", "compiler", "crash", "report"):
        logger = logging.getLogger(name)
        logger.setLevel(logging.INFO)
        logger.handlers.clear()

        handler = RotatingFileHandler(
            log_dir / f"{name}.log",
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
            encoding="utf-8",
        )
        formatter = logging.Formatter(
            "%(asctime)s | %(name)s | %(levelname)s | %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

        loggers[name] = logger

    return loggers
