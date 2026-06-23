import pytest
import tempfile
from pathlib import Path
from codemind.analyzer.architecture import ArchitectureAnalyzer


@pytest.fixture
def layered_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        for d in ["controllers", "services", "repositories", "models"]:
            (root / d).mkdir()
            (root / d / "__init__.py").write_text("")
        (root / "main.py").write_text("from fastapi import FastAPI\napp = FastAPI()")
        yield root


@pytest.fixture
def clean_arch_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        for d in ["domain", "application", "infrastructure", "interfaces"]:
            (root / d).mkdir()
            (root / d / "__init__.py").write_text("")
        yield root


def test_detect_layered(layered_repo):
    analyzer = ArchitectureAnalyzer(str(layered_repo))
    arch = analyzer.detect_architecture()
    assert any("Layered" in a["architecture"] for a in arch)


def test_detect_clean(clean_arch_repo):
    analyzer = ArchitectureAnalyzer(str(clean_arch_repo))
    arch = analyzer.detect_architecture()
    assert any("Clean" in a["architecture"] for a in arch)


def test_detect_frameworks(layered_repo):
    analyzer = ArchitectureAnalyzer(str(layered_repo))
    frameworks = analyzer.detect_frameworks()
    assert "FastAPI" in frameworks


def test_confidence(layered_repo):
    analyzer = ArchitectureAnalyzer(str(layered_repo))
    conf = analyzer._calculate_confidence()
    assert conf in ("High", "Medium", "Low")
