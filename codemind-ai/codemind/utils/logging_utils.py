import sys
import logging
from pathlib import Path
from typing import Optional


def setup_logging(
    name: str = "codemind",
    level: str = "INFO",
    log_file: Optional[str] = None,
) -> logging.Logger:
    """Configure and return a logger instance."""
    logger = logging.getLogger(name)

    log_level = getattr(logging, level.upper(), logging.INFO)
    logger.setLevel(log_level)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if not logger.handlers:
        console = logging.StreamHandler(sys.stdout)
        console.setFormatter(formatter)
        logger.addHandler(console)

        if log_file:
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.FileHandler(log_path, encoding="utf-8")
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)

    return logger
