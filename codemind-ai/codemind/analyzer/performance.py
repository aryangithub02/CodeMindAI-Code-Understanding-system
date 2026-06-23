import re
from pathlib import Path
from typing import Dict, List
from collections import defaultdict


class PerformanceAnalyzer:
    """Detects potential performance bottlenecks."""

    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()

    def analyze(self) -> Dict:
        return {
            "n_plus_one_queries": self._detect_n_plus_one(),
            "repeated_db_calls": self._detect_repeated_calls(),
            "large_loops": self._detect_large_loops(),
            "expensive_patterns": self._detect_expensive(),
            "suggestions": self._generate_suggestions(),
        }

    def _detect_n_plus_one(self) -> List[Dict]:
        findings = []
        patterns = [
            (r"for\s+\w+\s+in\s+\w+\.(?:all|filter|objects)", "N+1: iterating over ORM results"),
            (r"for\s+.*\s+in\s+.*:\s*\n\s+.*\.(?:get|filter)\(", "N+1: query inside loop"),
        ]

        for file_path in self.root_path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                for pattern, desc in patterns:
                    for match in re.finditer(pattern, content, re.MULTILINE):
                        findings.append({
                            "description": desc,
                            "file": str(file_path.relative_to(self.root_path)),
                            "line": content[:match.start()].count("\n") + 1,
                        })
            except Exception:
                pass
        return findings

    def _detect_repeated_calls(self) -> List[Dict]:
        findings = []
        for file_path in self.root_path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                lines = content.splitlines()
                line_groups = defaultdict(list)
                db_pattern = re.compile(r"\.(?:get|filter|all|first|save|commit|execute)\(", re.IGNORECASE)
                for i, line in enumerate(lines):
                    if db_pattern.search(line):
                        line_groups[line.strip()].append(i + 1)

                for line, line_numbers in line_groups.items():
                    if len(line_numbers) > 3:
                        findings.append({
                            "call": line.strip()[:80],
                            "file": str(file_path.relative_to(self.root_path)),
                            "occurrences": line_numbers,
                            "count": len(line_numbers),
                        })
            except Exception:
                pass
        return findings

    def _detect_large_loops(self) -> List[Dict]:
        findings = []
        for file_path in self.root_path.rglob("*.py"):
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                for match in re.finditer(r"for\s+\w+\s+in\s+(?:range\(\d{4,}|range\(len|\.all\(\))", content):
                    findings.append({
                        "description": "Large loop detected",
                        "file": str(file_path.relative_to(self.root_path)),
                        "line": content[:match.start()].count("\n") + 1,
                    })
            except Exception:
                pass
        return findings

    def _detect_expensive(self) -> List[Dict]:
        findings = []
        expensive_patterns = [
            (r"\.all\(\)", "Loading all records from DB - consider pagination"),
            (r"\.bulk_create", "Bulk operation - consider batch size"),
            (r"deepcopy", "Expensive deep copy operation"),
            (r"time\.sleep", "Blocking sleep in code"),
            (r"recursive", "Recursive function - check depth"),
            (r"while\s+True", "Infinite loop - ensure break condition"),
        ]

        for file_path in self.root_path.rglob("*"):
            if file_path.suffix not in (".py", ".js", ".ts"):
                continue
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                for pattern, desc in expensive_patterns:
                    for match in re.finditer(pattern, content, re.IGNORECASE):
                        findings.append({
                            "description": desc,
                            "file": str(file_path.relative_to(self.root_path)),
                            "line": content[:match.start()].count("\n") + 1,
                        })
            except Exception:
                pass
        return findings

    def _generate_suggestions(self) -> List[str]:
        return [
            "Add select_related/prefetch_related to reduce N+1 queries",
            "Use pagination for endpoints returning lists",
            "Add database indexes for frequently queried columns",
            "Consider connection pooling for database connections",
            "Use caching (Redis/Memcached) for frequently accessed data",
            "Implement lazy loading for expensive computations",
            "Use batch processing for large data operations",
            "Consider async/await for I/O-bound operations",
            "Profile slow endpoints with APM tools",
            "Use database query analysis to identify slow queries",
        ]
