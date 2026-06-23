import pytest
import json
import tempfile
from pathlib import Path
from codemind.config import Config


def test_default_config():
    config = Config()
    assert config.get("analysis.max_depth") == 5
    assert config.get("output.format") == "markdown"
    assert config.get("security.enabled") is True


def test_custom_config():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump({"analysis": {"max_depth": 10}}, f)
        config_path = f.name

    config = Config(config_path)
    assert config.get("analysis.max_depth") == 10
    assert config.get("output.format") == "markdown"

    Path(config_path).unlink()


def test_set_value():
    config = Config()
    config.set("custom.key", "value")
    assert config.get("custom.key") == "value"


def test_nonexistent_key():
    config = Config()
    assert config.get("nonexistent.key") is None


def test_custom_default():
    config = Config()
    assert config.get("nonexistent", "fallback") == "fallback"


def test_to_dict():
    config = Config()
    d = config.to_dict()
    assert "analysis" in d
    assert "output" in d
