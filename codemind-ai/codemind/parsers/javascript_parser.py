import re
from pathlib import Path
from typing import Dict, List, Optional, Any


class JavaScriptParser:
    """Parses JavaScript/TypeScript source files."""

    def __init__(self, file_path: Path):
        self.file_path = Path(file_path).resolve()
        self.content = self.file_path.read_text(encoding="utf-8", errors="ignore")

    def parse(self) -> Dict[str, Any]:
        return {
            "classes": self.parse_classes(),
            "functions": self.parse_functions(),
            "imports": self.parse_imports(),
            "exports": self.parse_exports(),
            "metrics": self.calculate_metrics(),
        }

    def parse_classes(self) -> List[Dict]:
        classes = []
        pattern = re.compile(
            r"(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?"
            r"(?:\s+implements\s+([^{]+))?",
            re.MULTILINE,
        )
        for match in pattern.finditer(self.content):
            methods = re.findall(
                r"(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*{",
                self._get_body(match.start()),
            )
            classes.append({
                "name": match.group(1),
                "extends": match.group(2),
                "implements": [i.strip() for i in match.group(3).split(",") if i.strip()] if match.group(3) else [],
                "methods": methods,
                "line": self.content[:match.start()].count("\n") + 1,
            })
        return classes

    def parse_functions(self) -> List[Dict]:
        functions = []
        patterns = [
            (r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)", "declaration"),
            (r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>", "arrow"),
            (r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)", "expression"),
        ]
        for pattern, func_type in patterns:
            for match in re.finditer(pattern, self.content):
                functions.append({
                    "name": match.group(1),
                    "params": [p.strip() for p in match.group(2).split(",") if p.strip()],
                    "type": func_type,
                    "line": self.content[:match.start()].count("\n") + 1,
                })
        return functions

    def parse_imports(self) -> List[Dict]:
        imports = []
        patterns = [
            (r"import\s+(.+?)\s+from\s+['\"](.+?)['\"]", "named"),
            (r"import\s+['\"](.+?)['\"]", "side_effect"),
            (r"const\s+(\w+)\s*=\s*require\(['\"](.+?)['\"]\)", "require"),
            (r"let\s+(\w+)\s*=\s*require\(['\"](.+?)['\"]\)", "require"),
            (r"var\s+(\w+)\s*=\s*require\(['\"](.+?)['\"]\)", "require"),
        ]
        for pattern, import_type in patterns:
            for match in re.finditer(pattern, self.content):
                if import_type == "named":
                    names = [n.strip() for n in match.group(1.replace("{", "").replace("}", "")).split(",")]
                    imports.append({
                        "module": match.group(2).split("/")[0],
                        "names": names,
                        "type": "named",
                    })
                elif import_type == "side_effect":
                    imports.append({"module": match.group(1).split("/")[0], "type": "side_effect"})
                else:
                    imports.append({"module": match.group(2).split("/")[0], "names": [match.group(1)], "type": "require"})
        return imports

    def parse_exports(self) -> List[Dict]:
        exports = []
        patterns = [
            (r"export\s+default\s+(?:function|class|const)\s+(\w+)", "default"),
            (r"export\s+const\s+(\w+)", "named_const"),
            (r"export\s+function\s+(\w+)", "named_func"),
            (r"export\s+class\s+(\w+)", "named_class"),
            (r"module\.exports\s*=\s*{?(\w+)", "commonjs"),
        ]
        for pattern, export_type in patterns:
            for match in re.finditer(pattern, self.content):
                exports.append({
                    "name": match.group(1),
                    "type": export_type,
                })
        return exports

    def _get_body(self, start: int) -> str:
        """Extract body starting from a position, counting braces."""
        content = self.content[start:]
        brace_count = 0
        in_body = False
        for i, ch in enumerate(content):
            if ch == "{":
                brace_count += 1
                in_body = True
            elif ch == "}":
                brace_count -= 1
                if in_body and brace_count == 0:
                    return content[:i + 1]
        return content

    def calculate_metrics(self) -> Dict:
        lines = self.content.splitlines()
        non_blank = [l for l in lines if l.strip()]
        comment_lines = [l for l in lines if l.strip().startswith("//") or l.strip().startswith("/*")]
        return {
            "total_lines": len(lines),
            "code_lines": len(non_blank),
            "comment_lines": len(comment_lines),
            "blank_lines": len(lines) - len(non_blank),
        }
