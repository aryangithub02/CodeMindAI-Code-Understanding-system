import re
from pathlib import Path
from typing import Dict, List
from dataclasses import dataclass, field


@dataclass
class SecurityFinding:
    severity: str
    category: str
    description: str
    file: str
    line: int = 0
    snippet: str = ""


class SecurityAnalyzer:
    """Scans the repository for common security issues."""

    PATTERNS = {
        "hardcoded_secrets": {
            "severity": "Critical",
            "patterns": [
                (re.compile(r"(?i)(?:password|passwd|pwd|secret|api.?key|api_key)\s*[=:]\s*['\"][^'\"]{8,}['\"]"), "Possible hardcoded credential"),
                (r"(?i)(?:token|auth_token|access_token|secret_key)\s*[=:]\s*['\"][^'\"]{8,}['\"]", "Possible hardcoded token"),
                (r"(?i)sk_live_|pk_live_|sk_test_|pk_test_", "Stripe API key detected"),
                (r"(?i)AKIA[0-9A-Z]{16}", "AWS Access Key ID detected"),
            ],
        },
        "sensitive_data_exposure": {
            "severity": "High",
            "patterns": [
                (r"(?i)\.env", "Environment file reference"),
                (r"(?i)config\.(?:json|yaml|yml|ini).*(?:password|secret|key)", "Config file may contain secrets"),
                (r"(?i)\.gitignore.*(?:\.env|credentials)", "Git-ignored sensitive files"),
            ],
        },
        "injection_risks": {
            "severity": "High",
            "patterns": [
                (r"(?i)execute\(.*\+|execute\(.*f['\"]", "Dynamic SQL execution"),
                (r"(?i)eval\s*\(|exec\s*\(", "Dynamic code execution"),
                (r"(?i)os\.system\(|subprocess\.(?:call|Popen|run)\(.*\+", "Command injection risk"),
                (r"(?i)unsafe|mark_safe|dangerouslySetInnerHTML", "XSS risk indicators"),
            ],
        },
        "missing_validation": {
            "severity": "Medium",
            "patterns": [
                (r"(?i)(?:request\.args|request\.form|request\.json)\[", "Direct request access without validation"),
                (r"(?i)\.query\(.*request", "SQL query with raw request data"),
                (r"(?i)RequestBody.*(?!Valid)", "Request body without validation annotation"),
            ],
        },
        "auth_issues": {
            "severity": "High",
            "patterns": [
                (r"(?i)@app\.route.*(?!@.*auth|login)", "Route without authentication decorator"),
                (r"(?i)allow_any|permit_all|skip_auth", "Authentication bypass"),
                (r"(?i)jwt\s*=\s*None|token\s*=\s*None", "Unsafe token handling"),
            ],
        },
        "unsafe_deserialization": {
            "severity": "Critical",
            "patterns": [
                (r"pickle\.loads|pickle\.load\(", "Unsafe pickle deserialization"),
                (r"yaml\.load\(|yaml\.loads\(", "Unsafe YAML deserialization (use safe_load)"),
                (r"eval\(|eval\s*\(", "Arbitrary code execution via eval"),
            ],
        },
    }

    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()

    def analyze(self) -> Dict:
        findings = []
        for file_path in self.root_path.rglob("*"):
            if file_path.suffix not in (".py", ".js", ".ts", ".tsx", ".jsx", ".cs", ".java", ".yaml", ".yml",
                                         ".json", ".env", ".env.*", ".ini", ".cfg", ".toml"):
                continue
            if file_path.name.startswith("test_") or file_path.name.startswith("spec_"):
                continue
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                findings.extend(self._scan_file(file_path, content))
            except Exception:
                continue

        return {
            "findings": [f.__dict__ for f in findings],
            "summary": self._summarize(findings),
            "severity_counts": self._severity_counts(findings),
        }

    def _scan_file(self, file_path: Path, content: str) -> List[SecurityFinding]:
        findings = []
        relative = str(file_path.relative_to(self.root_path))

        for category, config in self.PATTERNS.items():
            for pattern_tuple in config["patterns"]:
                if isinstance(pattern_tuple, tuple) and len(pattern_tuple) == 2:
                    pattern, description = pattern_tuple
                    compiled = re.compile(pattern) if isinstance(pattern, str) else pattern
                    for match in compiled.finditer(content):
                        line_num = content[:match.start()].count("\n") + 1
                        start = max(0, match.start() - 20)
                        end = min(len(content), match.end() + 20)
                        snippet = content[start:end].replace("\n", " ").strip()
                        findings.append(SecurityFinding(
                            severity=config["severity"],
                            category=category,
                            description=description,
                            file=relative,
                            line=line_num,
                            snippet=snippet[:100],
                        ))
        return findings

    def _summarize(self, findings: List[SecurityFinding]) -> Dict:
        return {
            "total_findings": len(findings),
            "critical": sum(1 for f in findings if f.severity == "Critical"),
            "high": sum(1 for f in findings if f.severity == "High"),
            "medium": sum(1 for f in findings if f.severity == "Medium"),
            "low": sum(1 for f in findings if f.severity == "Low"),
        }

    def _severity_counts(self, findings: List[SecurityFinding]) -> Dict[str, int]:
        counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        for f in findings:
            counts[f.severity] = counts.get(f.severity, 0) + 1
        return counts
