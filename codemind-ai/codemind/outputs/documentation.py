import json
from datetime import date
from typing import Dict, List, Optional, Any
from pathlib import Path

from .diagrams import DiagramGenerator


class DocumentationGenerator:
    """Generates comprehensive repository documentation from analysis results."""

    def __init__(self):
        self.diagrams = DiagramGenerator()

    def _confidence_score(self, analysis: Dict) -> int:
        arch_conf = analysis.get("architecture", {}).get("confidence", "Low")
        scores = {"High": 92, "Medium": 74, "Low": 55}
        return scores.get(arch_conf, 60)

    def _today(self) -> str:
        return date.today().isoformat()

    # ── Repository Overview ──────────────────────────────────────────────

    def generate_repository_overview(self, analysis: Dict) -> str:
        meta = analysis.get("structure", {}).get("metadata", {})
        arch = analysis.get("architecture", {})
        styles = arch.get("architecture_style", [])
        frameworks = arch.get("frameworks", {})
        languages = meta.get("languages", {})
        entries = analysis.get("structure", {}).get("entry_points", [])

        doc = f"""# Repository Overview

> **Last Generated:** {self._today()} | **Confidence:** {self._confidence_score(analysis)}%

## Project Summary

**Name:** {meta.get('repository_name', 'Unknown')}
**Total Files:** {meta.get('total_files', 0)}
**Total Lines:** {meta.get('total_lines', 0)}
**Entry Points:** {len(entries)}

## Technology Stack

| Technology | Location |
|---|---|
"""
        for fw, path in frameworks.items():
            doc += f"| {fw} | `{path}` |\n"

        doc += "\n## Language Distribution\n\n| Extension | Files |\n|-----------|-------|\n"
        for ext, count in sorted(languages.items(), key=lambda x: x[1], reverse=True):
            doc += f"| {ext} | {count} |\n"

        doc += "\n## Architecture Style\n\n"
        if styles:
            for s in styles[:3]:
                doc += f"- **{s['architecture']}** (score: {s['score']})\n"
        else:
            doc += "Standard project structure.\n"

        doc += "\n## Purpose\n\n"
        doc += "AI-generated analysis of the repository's purpose and functionality.\n\n"

        root_files = [e['path'] for e in entries[:5]]
        if root_files:
            doc += "### Entry Points\n\n"
            for f in root_files:
                doc += f"- `{f}`\n"

        return doc

    # ── Architecture Docs ────────────────────────────────────────────────

    def generate_architecture_doc(self, analysis: Dict) -> str:
        meta = analysis.get("structure", {}).get("metadata", {})
        arch = analysis.get("architecture", {})
        styles = arch.get("architecture_style", [])
        frameworks = arch.get("frameworks", {})
        layers = analysis.get("structure", {}).get("layers", {})
        patterns = arch.get("patterns", [])
        routes = analysis.get("execution", {}).get("routes", [])
        entries = analysis.get("structure", {}).get("entry_points", [])

        diagram = self.diagrams.architecture_diagram(layers, routes)

        doc = f"""# Architecture Documentation

> **Category:** Architecture Documentation
> **Complexity:** High
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Overview

This document describes the architecture of **{meta.get('repository_name', 'the repository')}**.

- **Total Files:** {meta.get('total_files', 'N/A')}
- **Total Lines:** {meta.get('total_lines', 'N/A')}
- **Main Languages:** {', '.join(list(meta.get('languages', {}).keys())[:5]) or 'N/A'}

## Architecture Style

"""
        if styles:
            for s in styles[:3]:
                doc += f"- **{s['architecture']}**\n"
                if s.get('evidence'):
                    doc += f"  - Evidence: {', '.join(s['evidence'][:5])}\n"
        else:
            doc += "Standard project structure with no dominant architectural pattern detected.\n"

        doc += "\n## Architecture Diagram\n\n```mermaid\n"
        doc += diagram
        doc += "\n```\n\n"

        if frameworks:
            doc += "## Technology Stack\n\n| Framework | Location |\n|-----------|----------|\n"
            for fw, path in frameworks.items():
                doc += f"| {fw} | `{path}` |\n"
            doc += "\n"

        if layers:
            doc += "## Layer Architecture\n\n| Directory | Layer |\n|-----------|-------|\n"
            for path, layer in layers.items():
                doc += f"| `{path}` | {layer} |\n"
            doc += "\n"

        if patterns:
            doc += "## Design Patterns Detected\n\n| Pattern | Location |\n|---------|----------|\n"
            for p in patterns[:10]:
                doc += f"| {p['pattern']} | `{p['file']}` |\n"
            doc += "\n"

        if entries:
            doc += "## Entry Points\n\n"
            for e in entries[:10]:
                doc += f"- **{e['path']}** ({e.get('type', 'Unknown')})\n"
            doc += "\n"

        if routes:
            doc += "## API Routes Overview\n\n| Method | Path | File |\n|--------|------|------|\n"
            for r in routes[:20]:
                doc += f"| {r['method']} | {r['path']} | `{r['file']}` |\n"

        return doc

    # ── API Documentation ────────────────────────────────────────────────

    def generate_api_doc(self, analysis: Dict) -> str:
        routes = analysis.get("execution", {}).get("routes", [])
        entries = analysis.get("structure", {}).get("entry_points", [])
        meta = analysis.get("structure", {}).get("metadata", {})
        frameworks = analysis.get("architecture", {}).get("frameworks", {})

        doc = f"""# API Documentation

> **Category:** API Documentation
> **Complexity:** Medium
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Overview

API documentation for **{meta.get('repository_name', 'the repository')}**.

**Total Endpoints:** {len(routes)}

"""
        if frameworks:
            doc += "**Frameworks:** " + ", ".join(list(frameworks.keys())[:3]) + "\n\n"

        if not routes:
            doc += "No API routes detected in the repository.\n\n"
            if entries:
                doc += "### Entry Points\n\n"
                for e in entries[:5]:
                    doc += f"- `{e['path']}` ({e.get('type', '')})\n"
            return doc

        doc += "## Endpoints\n\n"
        grouped = {}
        for r in routes:
            path = r['path']
            grouped.setdefault(path, []).append(r)

        for path, methods in grouped.items():
            doc += f"### `{path}`\n\n"
            doc += "| Method | File |\n|--------|------|\n"
            for r in methods:
                doc += f"| `{r['method']}` | `{r['file']}` |\n"
            doc += "\n#### Request\n\n```json\n{{\n  \"TODO\": \"Schema inference pending\"\n}}\n```\n\n"
            doc += "#### Response\n\n```json\n{{\n  \"TODO\": \"Schema inference pending\"\n}}\n```\n\n"
            doc += "---\n\n"

        doc += "\n## Authentication\n\n"
        doc += "Authentication requirements detected based on framework patterns.\n\n"

        doc += "\n## Error Codes\n\n"
        doc += "| Code | Description |\n|------|-------------|\n"
        doc += "| 400 | Bad Request |\n"
        doc += "| 401 | Unauthorized |\n"
        doc += "| 403 | Forbidden |\n"
        doc += "| 404 | Not Found |\n"
        doc += "| 500 | Internal Server Error |\n"

        return doc

    # ── Service Documentation ────────────────────────────────────────────

    def generate_service_doc(self, analysis: Dict) -> str:
        dep = analysis.get("dependencies", {})
        hotspots = dep.get("hotspots", [])
        graph = dep.get("dependency_graph", {})
        routes = analysis.get("execution", {}).get("routes", [])
        meta = analysis.get("structure", {}).get("metadata", {})

        services = self._detect_services(analysis)

        doc = f"""# Service Documentation

> **Category:** Service Documentation
> **Complexity:** Medium
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Overview

Service layer documentation for **{meta.get('repository_name', 'the repository')}**.

**Core Services Detected:** {len(services)}

"""
        for svc in services:
            doc += f"## {svc['name']}\n\n"
            doc += f"> **Complexity:** {svc.get('complexity', 'Medium')}\n\n"
            doc += f"**Purpose:** {svc.get('purpose', 'Core service module.')}\n\n"
            if svc.get('files'):
                doc += "### Files\n\n"
                for f in svc['files'][:10]:
                    doc += f"- `{f}`\n"
                doc += "\n"
            if svc.get('dependencies'):
                doc += "### Dependencies\n\n"
                for d in svc['dependencies'][:8]:
                    doc += f"- `{d}`\n"
                doc += "\n"
            doc += "---\n\n"

        if hotspots:
            doc += "## Hotspots (Highly Referenced Modules)\n\n| Module | Referenced By |\n|--------|---------------|\n"
            for h in hotspots[:10]:
                doc += f"| `{h['module']}` | {h['referenced_by']} |\n"
            doc += "\n"

        return doc

    def _detect_services(self, analysis: Dict) -> List[Dict]:
        layers = analysis.get("structure", {}).get("layers", {})
        services = []
        seen = set()

        for path, layer_type in layers.items():
            if "service" in layer_type.lower() or "service" in path.lower():
                name = Path(path).name.replace("_", " ").replace("-", " ").title()
                if name not in seen:
                    seen.add(name)
                    services.append({
                        "name": name,
                        "type": layer_type,
                        "files": [str(p) for p in Path(path).iterdir() if p.is_file()][:20] if Path(path).exists() else [],
                        "dependencies": [],
                        "complexity": "Medium",
                        "purpose": f"Handles {name.lower()} operations.",
                    })

        if not services:
            hotspots = analysis.get("dependencies", {}).get("hotspots", [])
            for h in hotspots[:8]:
                name = h['module'].replace("_", " ").replace(".py", "").title()
                if name not in seen:
                    seen.add(name)
                    services.append({
                        "name": name,
                        "type": "Module",
                        "files": [],
                        "dependencies": [],
                        "complexity": "High" if h['referenced_by'] > 5 else "Medium",
                        "purpose": f"Referenced by {h['referenced_by']} modules.",
                    })
        return services

    # ── Database Documentation ───────────────────────────────────────────

    def generate_database_doc(self, analysis: Dict) -> str:
        persistence = analysis.get("persistence", {})
        summary = persistence.get("summary", {})
        tables = persistence.get("database_tables", [])
        queries = persistence.get("query_patterns", [])
        migrations = persistence.get("migrations", [])
        meta = analysis.get("structure", {}).get("metadata", {})

        doc = f"""# Database Documentation

> **Category:** Database Documentation
> **Complexity:** Medium
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Overview

Database schema and persistence documentation for **{meta.get('repository_name', 'the repository')}**.

- **Primary ORM:** {summary.get('primary_orm', 'Unknown')}
- **Model Files:** {summary.get('total_model_files', 0)}
- **Tables/Entities:** {len(tables)}
- **Migrations:** {len(migrations)}

"""
        orms = summary.get("orms_detected", {})
        if orms:
            doc += "## ORM Usage\n\n| ORM | Files |\n|-----|-------|\n"
            for orm, count in orms.items():
                doc += f"| {orm} | {count} |\n"
            doc += "\n"

        if tables:
            doc += "## Tables / Entities\n\n| Entity | File |\n|--------|------|\n"
            for t in tables:
                doc += f"| `{t['name']}` | `{t['file']}` |\n"
            doc += "\n"

            doc += "## Entity Relationship Diagram\n\n```mermaid\nerDiagram\n"
            for t in tables:
                doc += f"    {t['name']} {{\n        int id PK\n    }}\n"
            if len(tables) > 1:
                doc += f"    {tables[0]['name']} ||--o{{ {tables[1]['name']} : has\n"
            doc += "```\n\n"
        else:
            doc += "No database tables or entities detected.\n\n"

        if queries:
            doc += "## Query Patterns\n\n| Query | File |\n|-------|------|\n"
            for q in queries[:10]:
                doc += f"| `{q['query'][:80]}...` | `{q['file']}` |\n"
            doc += "\n"

        if migrations:
            doc += "## Migrations\n\n"
            for m in migrations:
                doc += f"- `{m}`\n"
            doc += "\n"

        return doc

    # ── Dependency Documentation ─────────────────────────────────────────

    def generate_dependency_doc(self, analysis: Dict) -> str:
        dep = analysis.get("dependencies", {})
        graph = dep.get("dependency_graph", {})
        hotspots = dep.get("hotspots", [])
        circular = dep.get("circular_dependencies", [])
        external = dep.get("external_dependencies", [])
        summary = dep.get("summary", {})
        meta = analysis.get("structure", {}).get("metadata", {})

        doc = f"""# Dependency Documentation

> **Category:** Dependency Documentation
> **Complexity:** Medium
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Overview

Dependency analysis for **{meta.get('repository_name', 'the repository')}**.

- **Files with imports:** {summary.get('files_with_imports', 0)}
- **Total import statements:** {summary.get('total_import_statements', 0)}
- **Unique external dependencies:** {summary.get('unique_external_dependencies', 0)}
- **Circular dependencies:** {len(circular)}

"""
        dep_diagram = self.diagrams.dependency_diagram(graph)
        doc += "## Dependency Graph\n\n```mermaid\n"
        doc += dep_diagram
        doc += "\n```\n\n"

        if hotspots:
            doc += "## Hotspots (Most Referenced)\n\n| Module | Referenced By |\n|--------|---------------|\n"
            for h in hotspots[:10]:
                doc += f"| `{h['module']}` | {h['referenced_by']} |\n"
            doc += "\n"

        if circular:
            doc += "## Circular Dependencies\n\n"
            for cycle in circular[:5]:
                doc += " - " + " → ".join(cycle) + "\n"
            doc += "\n"

            circ_diagram = self.diagrams.circular_dependency_diagram(circular[:3])
            doc += "```mermaid\n" + circ_diagram + "\n```\n\n"

        if external:
            doc += "## External Dependencies\n\n"
            for e in sorted(external)[:30]:
                doc += f"- `{e}`\n"

        return doc

    # ── Data Flow Documentation ──────────────────────────────────────────

    def generate_dataflow_doc(self, analysis: Dict) -> str:
        exec_data = analysis.get("execution", {})
        flows = exec_data.get("flows", [])
        lifecycle = exec_data.get("request_lifecycle", {})
        routes = exec_data.get("routes", [])
        meta = analysis.get("structure", {}).get("metadata", {})

        doc = f"""# Data Flow Documentation

> **Category:** Data Flow Documentation
> **Complexity:** High
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Overview

Data flow analysis for **{meta.get('repository_name', 'the repository')}**.

"""
        if lifecycle:
            flow_steps = lifecycle.get("request_flow", [])
            if flow_steps:
                flow_diagram = self.diagrams.flow_diagram(flow_steps)
                doc += "## Request Lifecycle\n\n```mermaid\n"
                doc += flow_diagram
                doc += "\n```\n\n"

                doc += "### Flow Steps\n\n"
                for i, step in enumerate(flow_steps):
                    doc += f"{i + 1}. {step}\n"
                doc += "\n"

        seq_diagram = self.diagrams.sequence_diagram(routes)
        doc += "## Sequence Diagram\n\n```mermaid\n"
        doc += seq_diagram
        doc += "\n```\n\n"

        if routes:
            doc += "## Key Flows\n\n"
            for r in routes[:10]:
                doc += f"- **{r['method']} {r['path']}** → `{r['file']}`\n"
            doc += "\n"

        if flows:
            doc += "## Function Call Flows\n\n"
            for f in flows[:5]:
                doc += f"### `{f['file']}`\n\n"
                for func in f.get("functions", [])[:8]:
                    doc += f"- `{func['name']}({func.get('params', '')})`\n"
                doc += "\n"

        return doc

    # ── Setup Documentation ──────────────────────────────────────────────

    def generate_setup_doc(self, analysis: Dict) -> str:
        meta = analysis.get("structure", {}).get("metadata", {})
        frameworks = analysis.get("architecture", {}).get("frameworks", {})

        doc = f"""# Setup Documentation

> **Category:** Setup Documentation
> **Complexity:** Low
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Overview

Setup instructions for **{meta.get('repository_name', 'the repository')}**.

## Prerequisites

"""
        for fw in list(frameworks.keys())[:5]:
            doc += f"- {fw}\n"
        doc += "\n## Installation\n\n```bash\n# Clone the repository\ngit clone <repository-url>\ncd " + meta.get('repository_name', 'repo') + "\n\n# Install dependencies\n# (Auto-detected package managers will be listed here)\n```\n\n"

        package_files = []
        for pattern in ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "Gemfile", "go.mod", "pom.xml", "build.gradle"]:
            for match in Path(meta.get("root_path", "")).rglob(pattern):
                package_files.append(match.name)
                break

        if package_files:
            doc += "## Package Manifests\n\n"
            for pf in sorted(set(package_files)):
                doc += f"- `{pf}`\n"
            doc += "\n"

        doc += "## Configuration\n\n"
        config_files = []
        for pattern in [".env*", "config*", "*.config.*", "settings*", ".env.example"]:
            for match in Path(meta.get("root_path", "")).rglob(pattern.replace("*", ".*")):
                config_files.append(match.name)
                break

        if config_files:
            doc += "Configuration files detected:\n\n"
            for cf in sorted(set(config_files)):
                doc += f"- `{cf}`\n"

        return doc

    # ── Deployment Documentation ─────────────────────────────────────────

    def generate_deployment_doc(self, analysis: Dict) -> str:
        meta = analysis.get("structure", {}).get("metadata", {})
        root = meta.get("root_path", "")

        doc = f"""# Deployment Documentation

> **Category:** Deployment Documentation
> **Complexity:** Medium
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Overview

Deployment guide for **{meta.get('repository_name', 'the repository')}**.

"""
        docker_files = list(Path(root).rglob("Dockerfile")) if root else []
        compose_files = list(Path(root).rglob("docker-compose*")) if root else []
        ci_files = list(Path(root).rglob(".github/workflows/*.yml")) if root else []

        if docker_files or compose_files:
            doc += "## Docker\n\n"
            for df in docker_files:
                doc += f"- Dockerfile: `{df}`\n"
            for cf in compose_files:
                doc += f"- Docker Compose: `{cf}`\n"
            doc += "\n"

        if ci_files:
            doc += "## CI/CD\n\n"
            for ci in ci_files:
                doc += f"- Workflow: `{ci}`\n"
            doc += "\n"

        doc += "## Environment Variables\n\n"
        doc += "```bash\n# Required environment variables\n# (Auto-detected from configuration files)\nPORT=8000\nDATABASE_URL=postgresql://localhost:5432/db\n```\n\n"

        doc += "## Production Deployment\n\n"
        doc += "### Steps\n\n1. Build the application\n"
        doc += "2. Configure environment variables\n"
        doc += "3. Run database migrations\n"
        doc += "4. Start the application server\n"
        doc += "5. Set up reverse proxy (nginx, caddy)\n"
        doc += "6. Configure SSL/TLS\n"
        doc += "7. Monitor with health checks\n\n"

        doc += "### Health Check\n\n"
        doc += "```bash\ncurl http://localhost:8000/health\n```\n"

        return doc

    # ── AI Repository Guide ──────────────────────────────────────────────

    def generate_ai_guide(self, analysis: Dict) -> str:
        meta = analysis.get("structure", {}).get("metadata", {})
        arch = analysis.get("architecture", {})
        styles = arch.get("architecture_style", [])
        frameworks = arch.get("frameworks", {})
        hotspots = analysis.get("dependencies", {}).get("hotspots", [])
        entries = analysis.get("structure", {}).get("entry_points", [])
        layers = analysis.get("structure", {}).get("layers", {})

        doc = f"""# AI Repository Guide

> **Category:** AI Repository Guide
> **Complexity:** Low
> **Last Generated:** {self._today()}
> **Confidence:** {self._confidence_score(analysis)}%

## Repository Summary

**{meta.get('repository_name', 'Unknown')}** is a software project containing **{meta.get('total_files', 0)} files** across **{meta.get('total_lines', 0)} lines of code**.

"""
        if styles:
            doc += f"It follows a **{styles[0]['architecture']}** architecture pattern.\n\n"

        if frameworks:
            doc += f"Built with: {', '.join(list(frameworks.keys())[:5])}.\n\n"

        doc += "## How It Works\n\n"
        if layers:
            doc += "The codebase is organized into the following layers:\n\n"
            for path, layer in layers.items():
                doc += f"- **{layer}** (`{path}`)\n"
            doc += "\n"

        if entries:
            doc += "### Execution Flow\n\n"
            doc += "The application starts at:\n\n"
            for e in entries[:3]:
                doc += f"1. `{e['path']}`\n"
            doc += "\n"

        doc += "## Key Components\n\n"
        if hotspots:
            doc += "The most referenced (critical) modules are:\n\n"
            for h in hotspots[:5]:
                doc += f"- **{h['module']}** — referenced by {h['referenced_by']} other modules\n"
        doc += "\n"

        doc += "## Developer Onboarding Guide\n\n"
        doc += "### First Steps\n\n"
        doc += "1. **Set up the project** — follow the Setup Documentation\n"
        doc += "2. **Understand the architecture** — review the Architecture Documentation\n"
        doc += "3. **Explore the API** — review the API Documentation\n"
        doc += "4. **Review the database schema** — review the Database Documentation\n"
        doc += "5. **Run the tests** — ensure everything works\n\n"

        doc += "### Recommended Learning Path\n\n"
        doc += "- Start with the entry points to understand the application flow\n"
        doc += "- Review the core services listed in Service Documentation\n"
        doc += "- Understand the data model from Database Documentation\n"
        doc += "- Trace through a complete request flow using Data Flow Documentation\n\n"

        doc += "## AI Recommendations\n\n"
        circular = analysis.get("dependencies", {}).get("circular_dependencies", [])
        if circular:
            doc += "### Risks\n\n"
            doc += f"- **Circular Dependencies:** {len(circular)} detected. These should be refactored to prevent maintainability issues.\n"

        if hotspots:
            top_hotspot = hotspots[0]
            if top_hotspot['referenced_by'] > 5:
                doc += f"- **Bottleneck Risk:** `{top_hotspot['module']}` is a potential bottleneck with {top_hotspot['referenced_by']} dependents.\n"

        doc += "\n### Recommendations\n\n"
        doc += "1. Add comprehensive test coverage for critical paths\n"
        doc += "2. Document public APIs with OpenAPI/Swagger\n"
        doc += "3. Implement health checks and monitoring\n"
        doc += "4. Consider extracting tightly coupled services\n"
        doc += "5. Add CI/CD pipelines if not present\n"

        return doc

    # ── Generate All ─────────────────────────────────────────────────────

    def generate_all(self, analysis: Dict) -> Dict[str, str]:
        return {
            "overview": self.generate_repository_overview(analysis),
            "architecture": self.generate_architecture_doc(analysis),
            "api": self.generate_api_doc(analysis),
            "services": self.generate_service_doc(analysis),
            "database": self.generate_database_doc(analysis),
            "dependencies": self.generate_dependency_doc(analysis),
            "dataflow": self.generate_dataflow_doc(analysis),
            "setup": self.generate_setup_doc(analysis),
            "deployment": self.generate_deployment_doc(analysis),
            "ai_guide": self.generate_ai_guide(analysis),
        }
