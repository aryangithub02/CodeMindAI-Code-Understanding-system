import os
import re
from pathlib import Path
from typing import List, Set, Optional


class FileUtils:
    """Utility functions for file operations."""

    BINARY_EXTENSIONS = {
        ".pyc", ".pyo", ".so", ".dll", ".dylib", ".class", ".jar",
        ".war", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico",
        ".svg", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt",
        ".pptx", ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
        ".exe", ".msi", ".bin", ".dat", ".db", ".sqlite", ".sqlite3",
        ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4", ".avi",
        ".mov", ".wav", ".flac", ".ogg",
    }

    @staticmethod
    def is_binary(file_path: Path) -> bool:
        return file_path.suffix.lower() in FileUtils.BINARY_EXTENSIONS

    @staticmethod
    def is_source_file(file_path: Path) -> bool:
        source_extensions = {
            ".py", ".js", ".ts", ".tsx", ".jsx", ".cs", ".java",
            ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".scala",
            ".c", ".cpp", ".h", ".hpp", ".m", ".mm",
        }
        return file_path.suffix.lower() in source_extensions

    @staticmethod
    def safe_read(file_path: Path, fallback: str = "") -> str:
        try:
            return file_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            try:
                return file_path.read_text(encoding="latin-1", errors="replace")
            except Exception:
                return fallback

    @staticmethod
    def find_files(root: Path, pattern: str = "**/*") -> List[Path]:
        return list(root.glob(pattern))

    @staticmethod
    def get_relative_path(file_path: Path, base: Path) -> str:
        return str(file_path.relative_to(base))

    @staticmethod
    def count_lines(content: str) -> int:
        return len(content.splitlines())

    @staticmethod
    def get_file_stats(file_path: Path) -> dict:
        try:
            stat = file_path.stat()
            return {
                "size_bytes": stat.st_size,
                "modified": stat.st_mtime,
                "created": stat.st_ctime,
            }
        except Exception:
            return {}
