import re
from pathlib import Path
from typing import Dict, List
from collections import defaultdict


class QualityAnalyzer:
    """Analyzes code quality, detects code smells, and patterns."""

    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()

    def analyze(self) -> Dict:
        return {
            "large_classes": self._find_large_classes(),
            "god_functions": self._find_god_functions(),
            "duplicate_code": self._find_duplicates(),
            "dead_code": self._find_dead_code(),
            "unused_imports": self._find_unused_imports(),
            "todo_comments": self._find_todos(),
            "summary": self._summarize(),
        }

    def _find_large_classes(self, max_methods: int = 15) -> List[Dict]:
        large = []
        for file_path in self.root_path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                class_pattern = re.compile(r"^class\s+(\w+)", re.MULTILINE)
                method_pattern = re.compile(r"^\s+(?:async\s+)?def\s+\w+", re.MULTILINE)

                class_starts = [(m.start(), m.group(1)) for m in class_pattern.finditer(content)]

                for i, (start, name) in enumerate(class_starts):
                    end = class_starts[i + 1][0] if i + 1 < len(class_starts) else len(content)
                    class_body = content[start:end]
                    methods = method_pattern.findall(class_body)
                    if len(methods) > max_methods:
                        large.append({
                            "class": name,
                            "file": str(file_path.relative_to(self.root_path)),
                            "method_count": len(methods),
                        })
            except Exception:
                pass
        return large

    def _find_god_functions(self, max_lines: int = 100) -> List[Dict]:
        gods = []
        for file_path in self.root_path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                func_pattern = re.compile(r"^(?:async\s+)?def\s+(\w+)\s*\([^)]*\):\s*$", re.MULTILINE)

                func_starts = [(m.start(), m.group(1)) for m in func_pattern.finditer(content)]

                for i, (start, name) in enumerate(func_starts):
                    end = func_starts[i + 1][0] if i + 1 < len(func_starts) else len(content)
                    body = content[start:end]
                    lines = body.count("\n")
                    if lines > max_lines:
                        gods.append({
                            "function": name,
                            "file": str(file_path.relative_to(self.root_path)),
                            "line_count": lines,
                        })
            except Exception:
                pass
        return gods

    def _find_duplicates(self) -> List[Dict]:
        """Simple duplicate detection by measuring repeated blocks."""
        blocks = defaultdict(list)
        for file_path in self.root_path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                lines = content.splitlines()
                for i in range(len(lines) - 5):
                    block = "\n".join(lines[i:i + 5])
                    if len(block.strip()) > 50:
                        blocks[block].append(str(file_path.relative_to(self.root_path)) + f":{i+1}")
            except Exception:
                pass

        duplicates = [{ "block": b[:80], "locations": locs }
                       for b, locs in blocks.items() if len(locs) > 1]
        return sorted(duplicates, key=lambda x: len(x["locations"]), reverse=True)[:20]

    def _find_dead_code(self) -> List[Dict]:
        dead = []
        for file_path in self.root_path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                patterns = [
                    (r"#\s*TODO|#\s*FIXME|#\s*HACK|#\s*XXX", "todo_marker"),
                    (r"if\s+False\s*:", "dead_condition"),
                    (r"pass\s*#.*unused|pass\s*#.*never", "unused_code"),
                ]
                for pattern, label in patterns:
                    for match in re.finditer(pattern, content):
                        dead.append({
                            "type": label,
                            "file": str(file_path.relative_to(self.root_path)),
                            "line": content[:match.start()].count("\n") + 1,
                        })
            except Exception:
                pass
        return dead

    def _find_unused_imports(self) -> List[Dict]:
        unused = []
        for file_path in self.root_path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                imports = re.findall(r"^import\s+(\w+)|^from\s+(\w+)\s+import", content, re.MULTILINE)
                for imp in imports:
                    module = imp[0] or imp[1]
                    if module and module not in content.replace("import", "", 1):
                        unused.append({
                            "import": module,
                            "file": str(file_path.relative_to(self.root_path)),
                        })
            except Exception:
                pass
        return unused

    def _find_todos(self) -> List[Dict]:
        todos = []
        for file_path in self.root_path.rglob("*"):
            if file_path.suffix not in (".py", ".js", ".ts", ".tsx", ".jsx", ".cs", ".java", ".go", ".rs"):
                continue
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                for match in re.finditer(r"(?i)(?:TODO|FIXME|HACK|XXX|BUG|WORKAROUND)\s*[:-]?\s*(.*?)$", content, re.MULTILINE):
                    todos.append({
                        "text": match.group(1).strip()[:100],
                        "file": str(file_path.relative_to(self.root_path)),
                        "line": content[:match.start()].count("\n") + 1,
                    })
            except Exception:
                pass
        return todos

    def _summarize(self) -> Dict:
        return {
            "large_classes": len(self._find_large_classes()),
            "god_functions": len(self._find_god_functions()),
            "duplicates_found": len(self._find_duplicates()),
            "dead_code_fragments": len(self._find_dead_code()),
            "unused_imports": len(self._find_unused_imports()),
            "todo_items": len(self._find_todos()),
        }
