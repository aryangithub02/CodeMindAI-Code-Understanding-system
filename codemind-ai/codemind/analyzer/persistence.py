import re
from pathlib import Path
from typing import Dict, List
from collections import defaultdict


class PersistenceAnalyzer:
    """Analyzes database interactions, ORM usage, and queries."""

    ORM_PATTERNS = {
        "sqlalchemy": [
            re.compile(r"from\s+sqlalchemy", re.IGNORECASE),
            re.compile(r"import\s+sqlalchemy", re.IGNORECASE),
            re.compile(r"Column\s*\("),
            re.compile(r"declarative_base"),
            re.compile(r"session\.(query|add|commit|rollback|execute)"),
        ],
        "django_orm": [
            re.compile(r"from\s+django\.db", re.IGNORECASE),
            re.compile(r"models\.(CharField|IntegerField|ForeignKey|Model)"),
            re.compile(r"\.objects\.(filter|get|create|update|delete|all|select_related)"),
        ],
        "mongoose": [
            re.compile(r"from\s+mongoose", re.IGNORECASE),
            re.compile(r"require\(['\"]mongoose['\"]\)"),
            re.compile(r"new\s+Schema"),
            re.compile(r"\.model\("),
        ],
        "prisma": [
            re.compile(r"from\s+@prisma", re.IGNORECASE),
            re.compile(r"import\s+.*from\s+['\"]@prisma"),
            re.compile(r"prisma\.\w+\.(findMany|findUnique|create|update|delete)"),
        ],
        "typeorm": [
            re.compile(r"from\s+typeorm", re.IGNORECASE),
            re.compile(r"@Entity"), re.compile(r"@Column"),
            re.compile(r"getRepository"),
            re.compile(r"\.(find|findOne|save|delete|update)\s*\("),
        ],
        "entity_framework": [
            re.compile(r"using\s+Microsoft\.EntityFrameworkCore"),
            re.compile(r"DbContext"),
            re.compile(r"DbSet<"),
        ],
        "raw_sql": [
            re.compile(r"(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\s+(?:FROM|INTO|SET)", re.IGNORECASE),
            re.compile(r"execute\(['\"]\s*(?:SELECT|INSERT|UPDATE|DELETE)", re.IGNORECASE),
        ],
    }

    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()

    def analyze(self) -> Dict:
        usage = self._detect_orm_usage()
        return {
            "orm_usage": usage,
            "database_tables": self._detect_tables(usage),
            "query_patterns": self._detect_queries(),
            "migrations": self._find_migrations(),
            "summary": self._summarize(usage),
        }

    def _detect_orm_usage(self) -> Dict[str, List[str]]:
        usage = defaultdict(list)
        for file_path in self.root_path.rglob("*"):
            if file_path.suffix not in (".py", ".js", ".ts", ".cs"):
                continue
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                for orm, patterns in self.ORM_PATTERNS.items():
                    for pattern in patterns:
                        if pattern.search(content):
                            relative = str(file_path.relative_to(self.root_path))
                            if relative not in usage[orm]:
                                usage[orm].append(relative)
            except Exception:
                pass
        return dict(usage)

    def _detect_tables(self, usage: Dict[str, List[str]]) -> List[Dict]:
        tables = []
        table_pattern = re.compile(
            r"(?:class\s+(\w+)\s*\(.*?(?:Model|Base|DbContext))|"
            r"(?:table\s*['\"]?(\w+)['\"]?\s*{)|"
            r"(?:@Entity\(['\"]?(\w+)['\"]?\))",
            re.IGNORECASE,
        )
        for files in usage.values():
            for filepath in files:
                full_path = self.root_path / filepath
                try:
                    content = full_path.read_text(encoding="utf-8", errors="ignore")
                    for match in table_pattern.finditer(content):
                        name = next(g for g in match.groups() if g)
                        tables.append({"name": name, "file": filepath})
                except Exception:
                    pass
        return list({t["name"]: t for t in tables}.values())

    def _detect_queries(self) -> List[Dict]:
        queries = []
        for file_path in self.root_path.rglob("*"):
            if file_path.suffix not in (".py", ".js", ".ts"):
                continue
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                for match in self.ORM_PATTERNS["raw_sql"]:
                    for m in match.finditer(content):
                        queries.append({
                            "query": m.group(0)[:120],
                            "file": str(file_path.relative_to(self.root_path)),
                        })
            except Exception:
                pass
        return queries

    def _find_migrations(self) -> List[str]:
        migrations = []
        for pattern in ("**/migrations/*.py", "**/Migrations/*.cs", "**/migrations/*.js"):
            for match in self.root_path.glob(pattern):
                migrations.append(str(match.relative_to(self.root_path)))
        return migrations

    def _summarize(self, usage: Dict[str, List[str]]) -> Dict:
        detected = {orm: len(files) for orm, files in usage.items() if files}
        primary_orm = max(detected, key=detected.get) if detected else "none"
        return {
            "primary_orm": primary_orm,
            "orms_detected": detected,
            "total_model_files": sum(len(v) for v in usage.values()),
        }
