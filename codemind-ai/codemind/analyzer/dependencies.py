import re
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict


class DependencyAnalyzer:
    """Analyzes module dependencies within a repository."""

    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()
        self.import_patterns = {
            ".py": [
                re.compile(r"^import\s+(\S+)", re.MULTILINE),
                re.compile(r"^from\s+(\S+)\s+import", re.MULTILINE),
            ],
            ".js": [
                re.compile(r"require\(['\"](.+)['\"]\)"),
                re.compile(r"from\s+['\"](.+)['\"]"),
            ],
            ".ts": [
                re.compile(r"from\s+['\"](.+)['\"]"),
                re.compile(r"import\s+['\"](.+)['\"]"),
            ],
            ".tsx": [
                re.compile(r"from\s+['\"](.+)['\"]"),
                re.compile(r"import\s+['\"](.+)['\"]"),
            ],
            ".jsx": [
                re.compile(r"from\s+['\"](.+)['\"]"),
                re.compile(r"require\(['\"](.+)['\"]\)"),
            ],
        }

    def analyze(self) -> Dict:
        imports = self._collect_imports()
        return {
            "dependency_graph": self._build_graph(imports),
            "dependency_matrix": self._build_matrix(imports),
            "hotspots": self._find_hotspots(imports),
            "circular_dependencies": self._find_circular(imports),
            "external_dependencies": self._find_external(imports),
            "summary": self._summarize(imports),
        }

    def _collect_imports(self) -> Dict[str, Set[str]]:
        imports = defaultdict(set)
        for file_path in self.root_path.rglob("*"):
            if file_path.suffix not in self.import_patterns:
                continue
            if file_path.is_file():
                relative = str(file_path.relative_to(self.root_path))
                try:
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                    patterns = self.import_patterns[file_path.suffix]
                    for pattern in patterns:
                        for match in pattern.finditer(content):
                            imported = match.group(1).split(".")[0]
                            if imported:
                                imports[relative].add(imported)
                except Exception:
                    pass
        return dict(imports)

    def _build_graph(self, imports: Dict[str, Set[str]]) -> Dict[str, List[str]]:
        graph = {}
        local_modules = self._get_local_modules()
        for source, targets in imports.items():
            deps = []
            for target in targets:
                if target in local_modules or any(target in m for m in local_modules):
                    deps.append(f"{target}.py" if not target.endswith(".py") else target)
            if deps:
                graph[source] = deps
        return graph

    def _build_matrix(self, imports: Dict[str, Set[str]]) -> List[List]:
        modules = sorted(set(list(imports.keys()) + [dep for deps in imports.values() for dep in deps]))
        index = {m: i for i, m in enumerate(modules)}
        size = len(modules)
        matrix = [[0] * size for _ in range(size)]

        for source, targets in imports.items():
            if source in index:
                for target in targets:
                    if target in index:
                        matrix[index[source]][index[target]] += 1

        return {"modules": modules, "matrix": matrix}

    def _find_hotspots(self, imports: Dict[str, Set[str]]) -> List[Dict]:
        dep_count = defaultdict(int)
        for targets in imports.values():
            for target in targets:
                dep_count[target] += 1

        return [
            {"module": mod, "referenced_by": count}
            for mod, count in sorted(dep_count.items(), key=lambda x: x[1], reverse=True)[:20]
        ]

    def _find_circular(self, imports: Dict[str, Set[str]]) -> List[Tuple[str, str]]:
        """Detect circular dependencies via DFS."""
        local = self._get_local_modules()
        graph = defaultdict(set)
        for source, targets in imports.items():
            src_key = Path(source).stem
            for t in targets:
                if t in local:
                    graph[src_key].add(t)

        visited = set()
        rec_stack = set()
        cycles = []

        def dfs(node: str, path: List[str]):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            for neighbor in graph.get(node, set()):
                if neighbor not in visited:
                    dfs(neighbor, path)
                elif neighbor in rec_stack:
                    idx = path.index(neighbor)
                    cycle = path[idx:] + [neighbor]
                    cycles.append(cycle)
            path.pop()
            rec_stack.discard(node)

        for node in list(graph.keys()):
            if node not in visited:
                dfs(node, [])

        return cycles

    def _find_external(self, imports: Dict[str, Set[str]]) -> Set[str]:
        local = self._get_local_modules()
        external = set()
        for targets in imports.values():
            for target in targets:
                if target not in local:
                    external.add(target)
        return external

    def _get_local_modules(self) -> Set[str]:
        modules = set()
        for f in self.root_path.rglob("*.py"):
            modules.add(f.stem)
        for f in self.root_path.rglob("*.js"):
            modules.add(f.stem)
        for f in self.root_path.rglob("*.ts"):
            modules.add(f.stem)
        return modules

    def _summarize(self, imports: Dict[str, Set[str]]) -> Dict:
        total_files = len(imports)
        total_imports = sum(len(v) for v in imports.values())
        external = self._find_external(imports)
        return {
            "files_with_imports": total_files,
            "total_import_statements": total_imports,
            "unique_external_dependencies": len(external),
            "external_dependencies_list": sorted(external),
        }
