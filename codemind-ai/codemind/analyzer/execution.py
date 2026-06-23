import re
from pathlib import Path
from typing import Dict, List, Optional


class ExecutionAnalyzer:
    """Analyzes execution paths and request lifecycles."""

    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()
        self.route_patterns = [
            re.compile(r"@(?:app|router|route)\.(?:get|post|put|patch|delete|options)\(['\"](.+?)['\"]"),
            re.compile(r"(?:app|router)\.(?:get|post|put|patch|delete)\(['\"](.+?)['\"]"),
            re.compile(r"@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping)\(['\"](.+?)['\"]"),
            re.compile(r"Route::(?:get|post|put|patch|delete)\(['\"](.+?)['\"]"),
            re.compile(r"def (?:get|post|put|delete)\(self.*?\):"),
        ]

    def analyze(self) -> Dict:
        return {
            "entry_points": self.find_entry_points(),
            "routes": self.find_routes(),
            "request_lifecycle": self._map_lifecycle(),
            "flows": self._trace_flows(),
        }

    def find_entry_points(self) -> List[Dict]:
        patterns = [
            ("main.py", "python"), ("app.py", "python"), ("server.py", "python"),
            ("manage.py", "python"), ("index.js", "javascript"), ("server.js", "javascript"),
            ("app.js", "javascript"), ("index.ts", "typescript"), ("server.ts", "typescript"),
            ("Program.cs", "csharp"),
        ]

        entries = []
        for filename, lang in patterns:
            for match in self.root_path.rglob(filename):
                try:
                    content = match.read_text(encoding="utf-8", errors="ignore")
                    entries.append({
                        "path": str(match.relative_to(self.root_path)),
                        "language": lang,
                        "start_patterns": self._find_start_patterns(content),
                    })
                except Exception:
                    pass
        return entries

    def find_routes(self) -> List[Dict]:
        routes = []
        for file_path in self.root_path.rglob("*"):
            if file_path.suffix not in (".py", ".js", ".ts", ".tsx", ".jsx"):
                continue
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                for pattern in self.route_patterns:
                    for match in pattern.finditer(content):
                        routes.append({
                            "path": match.group(1),
                            "file": str(file_path.relative_to(self.root_path)),
                            "method": self._infer_method(match.group(0)),
                        })
            except Exception:
                pass
        return routes

    def _infer_method(self, match_text: str) -> str:
        methods = {"get": "GET", "post": "POST", "put": "PUT",
                    "patch": "PATCH", "delete": "DELETE", "options": "OPTIONS"}
        for key, value in methods.items():
            if key in match_text.lower():
                return value
        return "UNKNOWN"

    def _find_start_patterns(self, content: str) -> List[str]:
        patterns = []
        start_indicators = [
            r"app\.run", r"server\.listen", r"ApplicationBuilder",
            r"app\.listen", r"http\.createServer",
        ]
        for pattern in start_indicators:
            if re.search(pattern, content):
                patterns.append(pattern)
        return patterns

    def _map_lifecycle(self) -> Dict[str, List[str]]:
        return {
            "request_flow": [
                "User → API Gateway",
                "API Gateway → Router",
                "Router → Middleware Chain",
                "Middleware Chain → Controller/Handler",
                "Controller → Service",
                "Service → Repository",
                "Repository → Database/External Service",
                "Response ← Repository",
                "Response ← Service",
                "Response ← Controller",
                "Response ← Middleware Chain",
                "Response ← Router",
                "Response ← API Gateway",
                "Response → User",
            ]
        }

    def _trace_flows(self) -> List[Dict]:
        flows = []
        for file_path in self.root_path.rglob("*"):
            if file_path.suffix not in (".py", ".js", ".ts"):
                continue
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                functions = self._extract_functions(content, file_path.suffix)
                if functions:
                    flows.append({
                        "file": str(file_path.relative_to(self.root_path)),
                        "functions": functions,
                    })
            except Exception:
                pass
        return flows

    def _extract_functions(self, content: str, ext: str) -> List[Dict]:
        functions = []
        if ext == ".py":
            pattern = re.compile(r"^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)", re.MULTILINE)
        else:
            pattern = re.compile(r"(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)", re.MULTILINE)
            if ext in (".ts", ".tsx"):
                arrow = re.compile(r"(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>")
                for m in arrow.finditer(content):
                    functions.append({"name": m.group(1), "params": m.group(2), "type": "arrow"})
            class_method = re.compile(r"(\w+)\s*\(([^)]*)\)\s*{")
            for m in class_method.finditer(content):
                if not m.group(1).startswith(("if", "while", "for", "switch", "catch")):
                    functions.append({"name": m.group(1), "params": m.group(2), "type": "method"})

        for match in pattern.finditer(content):
            functions.append({"name": match.group(1), "params": match.group(2), "type": "function"})

        return functions
