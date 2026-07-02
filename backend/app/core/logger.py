import logging
import sys
from pathlib import Path

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

FORMATTER = logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(name)-35s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)

    if not logger.handlers:
        # Console
        console = logging.StreamHandler(sys.stdout)
        console.setLevel(logging.DEBUG)
        console.setFormatter(FORMATTER)

        # File
        file_h = logging.FileHandler(LOG_DIR / "devmind.log", encoding="utf-8")
        file_h.setLevel(logging.INFO)
        file_h.setFormatter(FORMATTER)

        logger.addHandler(console)
        logger.addHandler(file_h)
        logger.setLevel(logging.DEBUG)

    return logger
