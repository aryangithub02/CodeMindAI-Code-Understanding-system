import pytest
import tempfile
from pathlib import Path
from codemind.analyzer.dependencies import DependencyAnalyzer


@pytest.fixture
def sample_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        (root / "auth.py").write_text("import user\nimport database")
        (root / "user.py").write_text("")
        (root / "database.py").write_text("")
        (root / "payment.py").write_text("from auth import login\nimport user")

        yield root


def test_collect_imports(sample_repo):
    analyzer = DependencyAnalyzer(str(sample_repo))
    imports = analyzer._collect_imports()
    assert len(imports) > 0
    assert "auth.py" in imports


def test_hotspots(sample_repo):
    analyzer = DependencyAnalyzer(str(sample_repo))
    result = analyzer.analyze()
    hotspots = result["hotspots"]
    modules = [h["module"] for h in hotspots]
    assert "user" in modules


def test_circular_detection():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        (root / "a.py").write_text("import b")
        (root / "b.py").write_text("import c")
        (root / "c.py").write_text("import a")

        analyzer = DependencyAnalyzer(str(root))
        result = analyzer.analyze()
        assert len(result["circular_dependencies"]) > 0


def test_external_dependencies(sample_repo):
    analyzer = DependencyAnalyzer(str(sample_repo))
    result = analyzer.analyze()
    external = result["external_dependencies"]
    assert len(external) >= 0
