import pytest
import tempfile
from pathlib import Path
from codemind.analyzer.structure import StructureAnalyzer


@pytest.fixture
def sample_repo():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        (root / "main.py").write_text("print('hello')")
        (root / "app.py").write_text("def run(): pass")
        (root / "controllers").mkdir()
        (root / "controllers" / "user_controller.py").write_text("class UserController: pass")
        (root / "services").mkdir()
        (root / "services" / "user_service.py").write_text("class UserService: pass")
        (root / "models").mkdir()
        (root / "models" / "user.py").write_text("class User: pass")

        yield root


def test_metadata(sample_repo):
    analyzer = StructureAnalyzer(str(sample_repo))
    metadata = analyzer.get_metadata()
    assert metadata["total_files"] >= 4
    assert metadata["repository_name"] == sample_repo.name


def test_layers(sample_repo):
    analyzer = StructureAnalyzer(str(sample_repo))
    layers = analyzer.detect_layers()
    assert any("API Layer" in v for v in layers.values())
    assert any("Service Layer" in v for v in layers.values())
    assert any("Domain Layer" in v for v in layers.values())


def test_entry_points(sample_repo):
    analyzer = StructureAnalyzer(str(sample_repo))
    entries = analyzer.find_entry_points()
    paths = [e["path"] for e in entries]
    assert "main.py" in paths
    assert "app.py" in paths


def test_tree(sample_repo):
    analyzer = StructureAnalyzer(str(sample_repo))
    tree = analyzer.get_tree()
    assert len(tree) > 0


def test_nonexistent_path():
    with pytest.raises(FileNotFoundError):
        StructureAnalyzer("/nonexistent/path/12345")
