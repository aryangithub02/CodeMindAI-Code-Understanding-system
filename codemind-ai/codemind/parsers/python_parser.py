import re
from pathlib import Path
from typing import Dict, List, Optional, Any


class PythonParser:
    """Parses Python source files to extract structural information."""

    def __init__(self, file_path: Path):
        self.file_path = Path(file_path).resolve()
        self.content = self.file_path.read_text(encoding="utf-8", errors="ignore")

    def parse(self) -> Dict[str, Any]:
        return {
            "classes": self.parse_classes(),
            "functions": self.parse_functions(),
            "imports": self.parse_imports(),
            "decorators": self.parse_decorators(),
            "docstring": self.parse_docstring(),
            "metrics": self.calculate_metrics(),
        }

    def parse_classes(self) -> List[Dict]:
        classes = []
        pattern = re.compile(
            r"^class\s+(\w+)\s*(?:\(([^)]*)\))?:",
            re.MULTILINE,
        )
        for match in pattern.finditer(self.content):
            start = match.start()
            class_body = self._get_body(start)
            methods = re.findall(
                r"^\s+(?:async\s+)?def\s+(\w+)\s*\(", class_body, re.MULTILINE
            )
            classes.append({
                "name": match.group(1),
                "bases": [b.strip() for b in match.group(2).split(",") if b.strip()] if match.group(2) else [],
                "methods": methods,
                "line": self.content[:start].count("\n") + 1,
            })
        return classes

    def parse_functions(self) -> List[Dict]:
        functions = []
        pattern = re.compile(
            r"^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\S+))?:",
            re.MULTILINE,
        )
        for match in pattern.finditer(self.content):
            start = match.start()
            # Skip if inside a class
            preceding = self.content[:start]
            if re.search(r"^\s*class\s+\w+", preceding[::-1][:500][::-1]):
                continue
            functions.append({
                "name": match.group(1),
                "params": [p.strip() for p in match.group(2).split(",") if p.strip()],
                "return_type": match.group(3),
                "line": self.content[:start].count("\n") + 1,
            })
        return functions

    def parse_imports(self) -> List[Dict]:
        imports = []
        patterns = [
            (r"^import\s+(\S+)", "direct"),
            (r"^from\s+(\S+)\s+import\s+(.+)$", "from"),
        ]
        for pattern, import_type in patterns:
            for match in re.finditer(pattern, self.content, re.MULTILINE):
                if import_type == "direct":
                    modules = [m.strip() for m in match.group(1).split(",")]
                    for mod in modules:
                        imports.append({"module": mod.split(".")[0], "type": "direct"})
                else:
                    module = match.group(1)
                    names = [n.strip() for n in match.group(2).split(",")]
                    imports.append({
                        "module": module.split(".")[0],
                        "names": names,
                        "type": "from",
                    })
        return imports

    def parse_decorators(self) -> List[Dict]:
        decorators = []
        pattern = re.compile(r"^@(\w+(?:\.\w+)*)\s*(?:\(([^)]*)\))?", re.MULTILINE)
        for match in pattern.finditer(self.content):
            line_num = self.content[:match.start()].count("\n") + 1
            decorators.append({
                "name": match.group(1),
                "args": match.group(2) if match.group(2) else "",
                "line": line_num,
            })
        return decorators

    def parse_docstring(self) -> Optional[str]:
        match = re.match(r'^\s*(?:"""|\'\'\')(.*?)(?:"""|\'\'\')', self.content, re.DOTALL)
        if match:
            return match.group(1).strip()[:200]
        return None

    def _get_body(self, start: int) -> str:
        lines = self.content[start:].splitlines()
        if not lines:
            return ""
        indent = len(lines[0]) - len(lines[0].lstrip())
        body_lines = []
        for line in lines[1:]:
            if line.strip() == "":
                body_lines.append(line)
            elif len(line) - len(line.lstrip()) > indent:
                body_lines.append(line)
            else:
                break
        return "\n".join(body_lines)

    def calculate_metrics(self) -> Dict:
        lines = self.content.splitlines()
        non_blank = [l for l in lines if l.strip()]
        comment_lines = [l for l in lines if l.strip().startswith("#")]
        return {
            "total_lines": len(lines),
            "code_lines": len(non_blank),
            "comment_lines": len(comment_lines),
            "blank_lines": len(lines) - len(non_blank),
        }
