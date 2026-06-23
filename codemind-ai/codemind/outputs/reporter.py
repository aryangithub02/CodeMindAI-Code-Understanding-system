from typing import Dict, Any, List
from datetime import datetime


SECTION_TEMPLATE = """

# {}

---

{}

"""


class Reporter:
    """Generates comprehensive architecture reports."""

    def __init__(self, output_format: str = "markdown"):
        self.output_format = output_format

    def generate_report(self, analysis: Dict[str, Any], report_type: str = "full") -> str:
        report = self._generate_header(analysis)
        report += SECTION_TEMPLATE.format("Architecture Summary", self._format_architecture(analysis))
        report += SECTION_TEMPLATE.format("Technology Stack", self._format_tech_stack(analysis))
        report += SECTION_TEMPLATE.format("Repository Structure", self._format_structure(analysis))
        report += SECTION_TEMPLATE.format("Main Modules", self._format_modules(analysis))
        report += SECTION_TEMPLATE.format("Entry Points", self._format_entry_points(analysis))
        report += SECTION_TEMPLATE.format("Dependency Analysis", self._format_dependencies(analysis))
        report += SECTION_TEMPLATE.format("Data Flow", self._format_data_flow())
        report += SECTION_TEMPLATE.format("Critical Components", self._format_critical(analysis))

        if report_type in ("full", "security"):
            report += SECTION_TEMPLATE.format("Security Findings", self._format_security(analysis))
        if report_type in ("full", "quality"):
            report += SECTION_TEMPLATE.format("Code Quality Findings", self._format_quality(analysis))

        report += SECTION_TEMPLATE.format("Onboarding Guide", self._format_onboarding(analysis))
        report += SECTION_TEMPLATE.format("Suggested Improvements", self._format_improvements(analysis))
        report += SECTION_TEMPLATE.format("Mermaid Architecture Diagram", self._format_diagram(analysis))
        report += SECTION_TEMPLATE.format("Confidence Score", self._format_confidence(analysis))
        return report

    def _generate_header(self, analysis: Dict) -> str:
        metadata = analysis.get("structure", {}).get("metadata", {})
        return (
            f"# CodeMind AI Architecture Report\n\n"
            f"**Repository:** {metadata.get('repository_name', 'N/A')}\n\n"
            f"**Generated:** {datetime.now().isoformat()}\n\n"
            f"**Total Files:** {metadata.get('total_files', 'N/A')}\n\n"
            f"**Total Lines:** {metadata.get('total_lines', 'N/A')}\n\n"
            f"---\n"
        )

    def _format_architecture(self, analysis: Dict) -> str:
        arch = analysis.get("architecture", {}).get("architecture_style", [])
        if not arch:
            return "Insufficient repository context available."
        lines = []
        for a in arch:
            lines.append(f"- **{a['architecture']}** (score: {a['score']})")
            for ev in a.get("evidence", [])[:3]:
                lines.append(f"  - Evidence: `{ev}`")
        return "\n".join(lines)

    def _format_tech_stack(self, analysis: Dict) -> str:
        frameworks = analysis.get("architecture", {}).get("frameworks", {})
        if not frameworks:
            return "Insufficient repository context available."
        return "\n".join(f"- **{fw}**: `{path}`" for fw, path in frameworks.items())

    def _format_structure(self, analysis: Dict) -> str:
        layers = analysis.get("structure", {}).get("layers", {})
        if not layers:
            return "Insufficient repository context available."
        return "\n".join(f"- `{path}` → **{layer}**" for path, layer in layers.items())

    def _format_modules(self, analysis: Dict) -> str:
        dep = analysis.get("dependencies", {})
        hotspots = dep.get("hotspots", [])
        if not hotspots:
            return "Insufficient repository context available."
        return "\n".join(
            f"- **{h['module']}** — referenced by {h['referenced_by']} modules"
            for h in hotspots[:10]
        )

    def _format_entry_points(self, analysis: Dict) -> str:
        entries = analysis.get("structure", {}).get("entry_points", [])
        if not entries:
            return "Insufficient repository context available."
        return "\n".join(f"- `{e['path']}` ({e['type']})" for e in entries)

    def _format_dependencies(self, analysis: Dict) -> str:
        dep = analysis.get("dependencies", {})
        summary = dep.get("summary", {})
        cycles = dep.get("circular_dependencies", [])
        external = dep.get("external_dependencies", [])

        lines = ["**Dependency Summary:**"]
        lines.append(f"- Files with imports: {summary.get('files_with_imports', 0)}")
        lines.append(f"- Total import statements: {summary.get('total_import_statements', 0)}")
        lines.append(f"- External dependencies: {summary.get('unique_external_dependencies', 0)}")

        if cycles:
            lines.append(f"\n**Circular Dependencies ({len(cycles)}):**")
            for cycle in cycles[:5]:
                lines.append(f"- {' → '.join(cycle)}")

        if external:
            lines.append(f"\n**External Dependencies:**")
            for ext in sorted(external)[:15]:
                lines.append(f"- `{ext}`")

        return "\n".join(lines)

    def _format_data_flow(self) -> str:
        return (
            "```text\n"
            "User\n"
            "→ API Gateway\n"
            "→ Router\n"
            "→ Middleware Chain\n"
            "→ Controller/Handler\n"
            "→ Service\n"
            "→ Repository\n"
            "→ Database/External Service\n"
            "→ Response\n"
            "```"
        )

    def _format_critical(self, analysis: Dict) -> str:
        dep = analysis.get("dependencies", {})
        hotspots = dep.get("hotspots", [])
        if hotspots:
            critical = hotspots[:5]
            return "\n".join(
                f"- **{h['module']}** — {h['referenced_by']} dependents (high coupling)"
                for h in critical
            )
        return "Insufficient repository context available."

    def _format_security(self, analysis: Dict) -> str:
        sec = analysis.get("security", {})
        summary = sec.get("summary", {})
        findings = sec.get("findings", [])

        lines = [f"**Severity Breakdown:**"]
        for sev in ["Critical", "High", "Medium", "Low"]:
            count = summary.get(sev.lower(), 0) if isinstance(summary.get(sev.lower()), int) else 0
            lines.append(f"- {sev}: {count}")

        if findings:
            lines.append(f"\n**Findings:**")
            for f in findings[:10]:
                lines.append(f"- [{f['severity']}] {f['description']} — `{f['file']}:{f['line']}`")

        return "\n".join(lines) if findings else "No security issues detected."

    def _format_quality(self, analysis: Dict) -> str:
        quality = analysis.get("quality", {})
        summary = quality.get("summary", {})

        lines = []
        for key, value in summary.items():
            label = key.replace("_", " ").title()
            lines.append(f"- {label}: {value}")

        todos = quality.get("todo_comments", [])
        if todos:
            lines.append(f"\n**TODO/FIXME Items ({len(todos)}):**")
            for t in todos[:5]:
                lines.append(f"- `{t['file']}:{t['line']}` — {t['text']}")

        return "\n".join(lines)

    def _format_onboarding(self, analysis: Dict) -> str:
        metadata = analysis.get("structure", {}).get("metadata", {})
        entries = analysis.get("structure", {}).get("entry_points", [])
        hotspots = analysis.get("dependencies", {}).get("hotspots", [])

        lines = [
            "### Day 1: Orientation\n",
            "- Understand repository structure and layers",
            f"- Review main entry points: {', '.join(e['path'] for e in entries[:3])}",
            "- Set up local development environment",
            "- Understand authentication flow",
            "",
            "### Day 2: Core Architecture\n",
            "- Study core services and their responsibilities",
            "- Review database layer and ORM usage",
            "- Analyze API routes and controllers",
            f"- Focus on critical modules: {', '.join(h['module'] for h in hotspots[:3])}",
            "",
            "### Day 3: Deep Dive\n",
            "- Trace a complete request lifecycle",
            "- Understand business workflows",
            "- Review deployment and CI/CD pipelines",
            "- Run tests and verify understanding",
        ]
        return "\n".join(lines)

    def _format_improvements(self, analysis: Dict) -> str:
        quality = analysis.get("quality", {}).get("summary", {})
        security = analysis.get("security", {}).get("summary", {})
        dep = analysis.get("dependencies", {})

        suggestions = []
        if quality.get("god_functions", 0) > 0:
            suggestions.append("- **Refactor large functions** — break down god functions into smaller, testable units")
        if quality.get("large_classes", 0) > 0:
            suggestions.append("- **Split large classes** — follow Single Responsibility Principle")
        if dep.get("circular_dependencies"):
            suggestions.append("- **Resolve circular dependencies** — extract shared interfaces or modules")
        if quality.get("duplicates_found", 0) > 0:
            suggestions.append("- **Eliminate duplicate code** — extract shared utilities")
        if security.get("critical", 0) > 0 or security.get("high", 0) > 0:
            suggestions.append("- **Address security findings** — prioritize critical and high severity issues")
        suggestions.append("- **Add comprehensive tests** — increase coverage for core modules")
        suggestions.append("- **Improve documentation** — add docstrings and API documentation")

        return "\n".join(suggestions)

    def _format_diagram(self, analysis: Dict) -> str:
        return (
            "```mermaid\n"
            "graph TD\n"
            "    Client --> API[API Gateway]\n"
            "    API --> Router\n"
            "    Router --> Controller\n"
            "    Controller --> Service\n"
            "    Service --> Repository\n"
            "    Repository --> Database[(Database)]\n"
            "    Service --> External[External Services]\n"
            "```"
        )

    def _format_confidence(self, analysis: Dict) -> str:
        arch_conf = analysis.get("architecture", {}).get("confidence", "N/A")
        return f"**Confidence:** {arch_conf}\n\n*Based on available repository evidence.*"
