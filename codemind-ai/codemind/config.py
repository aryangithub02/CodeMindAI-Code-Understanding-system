import json
from pathlib import Path
from typing import Dict, Any, Optional


class Config:
    """Loads and manages configuration for CodeMind AI."""

    DEFAULT_CONFIG = {
        "analysis": {
            "max_depth": 5,
            "max_file_size_kb": 500,
            "include_patterns": ["*.py", "*.js", "*.ts", "*.tsx", "*.jsx", "*.cs", "*.java", "*.go", "*.rs"],
            "exclude_dirs": ["__pycache__", "node_modules", ".git", ".venv", "venv", "dist", "build"],
        },
        "output": {
            "format": "markdown",
            "report_type": "full",
            "diagrams": True,
            "verbose": False,
        },
        "security": {
            "enabled": True,
            "severity_threshold": "medium",
        },
        "quality": {
            "enabled": True,
            "max_class_methods": 15,
            "max_function_lines": 100,
        },
    }

    def __init__(self, config_path: Optional[str] = None):
        self.config = self.DEFAULT_CONFIG.copy()
        if config_path:
            self._load_file(config_path)

    def _load_file(self, path: str):
        config_file = Path(path)
        if config_file.exists():
            try:
                with open(config_file, encoding="utf-8") as f:
                    user_config = json.load(f)
                self._merge(user_config)
            except (json.JSONDecodeError, IOError) as e:
                raise ValueError(f"Failed to load config from {path}: {e}")

    def _merge(self, user_config: Dict):
        def deep_merge(base, override):
            for key, value in override.items():
                if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                    deep_merge(base[key], value)
                else:
                    base[key] = value
        deep_merge(self.config, user_config)

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split(".")
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
        return value if value is not None else default

    def set(self, key: str, value: Any):
        keys = key.split(".")
        target = self.config
        for k in keys[:-1]:
            target = target.setdefault(k, {})
        target[keys[-1]] = value

    def to_dict(self) -> Dict:
        return self.config.copy()
