import os
import json
from pathlib import Path
from typing import Dict, List, Optional


class StructureAnalyzer:
    """Analyzes repository directory and file structure."""

    IGNORED_DIRS = {
        "__pycache__", "node_modules", ".git", ".venv", "venv",
        "dist", "build", ".tox", ".egg-info", "target",
    }

    IGNORED_EXTENSIONS = {
        ".pyc", ".pyo", ".so", ".dll", ".dylib",
        ".class", ".jar", ".war",
    }

    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()
        if not self.root_path.exists():
            raise FileNotFoundError(f"Path does not exist: {root_path}")

    def analyze(self) -> Dict:
        return {
            "metadata": self.get_metadata(),
            "tree": self.get_tree(),
            "layers": self.detect_layers(),
            "file_summary": self.summarize_files(),
            "entry_points": self.find_entry_points(),
        }

    def get_metadata(self) -> Dict:
        total_files = 0
        total_dirs = 0
        total_lines = 0
        languages = {}

        for file_path in self.root_path.rglob("*"):
            if self._is_ignored(file_path):
                continue
            if file_path.is_file():
                total_files += 1
                ext = file_path.suffix.lower()
                languages[ext] = languages.get(ext, 0) + 1
                try:
                    total_lines += len(file_path.read_text(encoding="utf-8", errors="ignore").splitlines())
                except Exception:
                    pass
            elif file_path.is_dir():
                total_dirs += 1

        return {
            "repository_name": self.root_path.name,
            "total_files": total_files,
            "total_directories": total_dirs,
            "total_lines": total_lines,
            "languages": dict(sorted(languages.items(), key=lambda x: x[1], reverse=True)),
            "root_path": str(self.root_path),
        }

    def get_tree(self, max_depth: int = 5) -> List[Dict]:
        return self._build_tree(self.root_path, 0, max_depth)

    def _build_tree(self, path: Path, depth: int, max_depth: int) -> List[Dict]:
        if depth > max_depth:
            return []
        entries = []
        try:
            for child in sorted(path.iterdir()):
                if self._is_ignored(child):
                    continue
                entry = {"name": child.name, "type": "directory" if child.is_dir() else "file"}
                if child.is_dir():
                    entry["children"] = self._build_tree(child, depth + 1, max_depth)
                entries.append(entry)
        except PermissionError:
            pass
        return entries

    def detect_layers(self) -> Dict[str, str]:
        layer_keywords = {
            "controllers": "API Layer",
            "routes": "API Layer",
            "api": "API Layer",
            "handlers": "API Layer",
            "services": "Service Layer",
            "service": "Service Layer",
            "usecases": "Application Layer",
            "use_cases": "Application Layer",
            "repositories": "Persistence Layer",
            "repository": "Persistence Layer",
            "dao": "Persistence Layer",
            "models": "Domain Layer",
            "domain": "Domain Layer",
            "entities": "Domain Layer",
            "infrastructure": "Infrastructure Layer",
            "infra": "Infrastructure Layer",
            "config": "Configuration",
            "middleware": "Middleware",
            "utils": "Utilities",
            "shared": "Shared",
            "common": "Shared",
        }

        detected = {}
        for child in self.root_path.iterdir():
            if child.is_dir() and child.name in layer_keywords:
                detected[str(child)] = layer_keywords[child.name]
        return detected

    def summarize_files(self) -> Dict[str, int]:
        summary = {}
        for file_path in self.root_path.rglob("*"):
            if self._is_ignored(file_path):
                continue
            if file_path.is_file():
                ext = file_path.suffix.lower()
                summary[ext] = summary.get(ext, 0) + 1
        return summary

    def find_entry_points(self) -> List[Dict]:
        entry_patterns = [
            "main.py", "app.py", "server.py", "wsgi.py", "manage.py",
            "index.js", "index.ts", "server.js", "server.ts", "app.js", "app.ts",
            "main.ts", "main.js", "Program.cs", "Program.fs",
            "index.tsx", "main.tsx", "App.tsx",
            "consumer.py", "worker.py", "celery.py",
        ]

        entries = []
        for pattern in entry_patterns:
            for match in self.root_path.rglob(pattern):
                if not self._is_ignored(match):
                    entries.append({
                        "path": str(match.relative_to(self.root_path)),
                        "type": self._classify_entry(pattern),
                    })
        return entries

    def _classify_entry(self, pattern: str) -> str:
        if pattern in ("index.tsx", "main.tsx", "App.tsx", "index.js", "main.js"):
            return "frontend"
        if pattern in ("consumer.py", "worker.py", "celery.py"):
            return "worker"
        if pattern.endswith(".cs") or pattern.endswith(".fs"):
            return "backend"
        return "backend"

    def _is_ignored(self, path: Path) -> bool:
        parts = path.parts
        for ignored in self.IGNORED_DIRS:
            if ignored in parts:
                return True
        if path.suffix in self.IGNORED_EXTENSIONS:
            return True
        return False
