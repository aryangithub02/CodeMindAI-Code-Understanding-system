import pytest
import tempfile
from pathlib import Path
import secrets
from codemind.analyzer.security import SecurityAnalyzer


@pytest.fixture
def vulnerable_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        (root / "config.py").write_text(
            f"password = '{secrets.token_urlsafe(16)}'\n"
            f"API_KEY = '{secrets.token_hex(16)}'\n"
            f"secret = '{secrets.token_urlsafe(16)}'\n"
        )
        (root / "unsafe.py").write_text(
            "import pickle\n"
            "data = pickle.loads(blob)\n"
            "result = eval(user_input)\n"
        )
        (root / "safe.py").write_text(
            "import yaml\n"
            "data = yaml.safe_load(content)\n"
        )
        yield root


def test_detect_hardcoded_secrets(vulnerable_repo):
    analyzer = SecurityAnalyzer(str(vulnerable_repo))
    result = analyzer.analyze()
    findings = result["findings"]
    secrets = [f for f in findings if f["category"] == "hardcoded_secrets"]
    assert len(secrets) > 0


def test_detect_unsafe_deserialization(vulnerable_repo):
    analyzer = SecurityAnalyzer(str(vulnerable_repo))
    result = analyzer.analyze()
    findings = result["findings"]
    unsafe = [f for f in findings if f["category"] == "unsafe_deserialization"]
    assert len(unsafe) > 0


def test_summary(vulnerable_repo):
    analyzer = SecurityAnalyzer(str(vulnerable_repo))
    result = analyzer.analyze()
    summary = result["summary"]
    assert summary["total_findings"] > 0


def test_no_false_positives():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        (root / "clean.py").write_text(
            "x = 42\n"
            "def hello():\n"
            "    return 'world'\n"
        )
        analyzer = SecurityAnalyzer(str(root))
        result = analyzer.analyze()
        assert len(result["findings"]) == 0
