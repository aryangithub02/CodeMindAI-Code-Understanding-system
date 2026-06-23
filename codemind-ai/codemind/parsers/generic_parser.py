import re
from pathlib import Path
from typing import Dict, List, Optional, Any


class GenericParser:
    """Fallback parser for languages without a specialized parser."""

    COMMENT_PATTERNS = {
        ".py": "#", ".rb": "#", ".pl": "#", ".sh": "#",
        ".js": ("//", "/*"), ".ts": ("//", "/*"), ".jsx": ("//", "/*"), ".tsx": ("//", "/*"),
        ".cs": ("//", "/*"), ".java": ("//", "/*"), ".go": ("//", "/*"),
        ".rs": ("//", "/*"), ".swift": ("//", "/*"), ".kt": ("//", "/*"),
        ".c": ("//", "/*"), ".cpp": ("//", "/*"), ".h": ("//", "/*"), ".hpp": ("//", "/*"),
        ".php": ("//", "/*", "#"),
        ".yaml": "#", ".yml": "#", ".toml": "#", ".ini": ";", ".cfg": "#",
    }

    def __init__(self, file_path: Path):
        self.file_path = Path(file_path).resolve()
        self.content = self.file_path.read_text(encoding="utf-8", errors="ignore")

    def parse(self) -> Dict[str, Any]:
        return {
            "metrics": self.calculate_metrics(),
            "structure": self.detect_structure(),
            "language": self.file_path.suffix,
        }

    def calculate_metrics(self) -> Dict:
        lines = self.content.splitlines()
        non_blank = [l for l in lines if l.strip()]
        comment_lines = self._count_comments(lines)
        return {
            "total_lines": len(lines),
            "code_lines": len(non_blank),
            "comment_lines": comment_lines,
            "blank_lines": len(lines) - len(non_blank),
        }

    def _count_comments(self, lines: List[str]) -> int:
        ext = self.file_path.suffix.lower()
        if ext not in self.COMMENT_PATTERNS:
            return 0
        patterns = self.COMMENT_PATTERNS[ext]
        if isinstance(patterns, str):
            return sum(1 for l in lines if l.strip().startswith(patterns))
        count = 0
        in_block = False
        for line in lines:
            stripped = line.strip()
            if in_block:
                count += 1
                if "*/" in stripped:
                    in_block = False
            elif stripped.startswith(patterns[1]):
                in_block = True
                count += 1
            elif stripped.startswith(patterns[0]):
                count += 1
        return count

    def detect_structure(self) -> Dict:
        ext = self.file_path.suffix.lower()
        ext_map = {
            ".json": "data/json",
            ".yaml": "data/yaml", ".yml": "data/yaml",
            ".toml": "data/toml",
            ".xml": "data/xml",
            ".html": "markup/html",
            ".css": "style/css",
            ".scss": "style/scss",
            ".md": "documentation/markdown",
            ".sql": "database/sql",
            ".env": "config/env",
            ".ini": "config/ini",
            ".cfg": "config/ini",
            ".dockerfile": "devops/docker",
            ".yml": "devops/yaml",
        }
        return {
            "category": ext_map.get(ext, f"unknown/{ext}"),
            "size_bytes": len(self.content),
        }
