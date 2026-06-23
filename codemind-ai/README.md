# CodeMind AI

Repository Intelligence System — analyze, document, and understand any codebase.

## Features

- **Architecture Detection** — automatically identifies layered, clean, hexagonal, MVC, event-driven, and microservices architectures
- **Dependency Analysis** — builds dependency graphs, detects circular dependencies, and identifies critical modules
- **Security Scanning** — detects hardcoded secrets, injection risks, unsafe deserialization, and auth bypasses
- **Code Quality** — finds god classes, large functions, duplicate code, and dead code
- **Knowledge Graph** — builds a queryable graph of files, classes, functions, routes, and their relationships
- **Documentation Generation** — generates architecture, API, service, and database documentation
- **Onboarding Guides** — creates structured onboarding plans for new developers
- **Mermaid Diagrams** — generates architecture, dependency, and sequence diagrams
- **Report Templates** — exports findings in markdown or JSON

## Quick Start

```bash
# Install
pip install -e .

# Run full analysis
codemind analyze /path/to/repo

# Generate architecture diagram
codemind graph /path/to/repo --format mermaid

# Security scan
codemind security /path/to/repo

# Generate onboarding guide
codemind onboarding /path/to/repo --days 5

# Quick summary
codemind summary /path/to/repo
```

## Commands

| Command | Description |
|---------|-------------|
| `analyze` | Full repository analysis with report |
| `graph` | Generate dependency/knowledge graph |
| `security` | Security vulnerability scan |
| `quality` | Code quality analysis |
| `onboarding` | Developer onboarding guide |
| `doc` | Generate documentation |
| `summary` | Quick repository summary |

## Output

Reports include:

- Architecture summary
- Technology stack
- Repository structure
- Module analysis
- Entry points
- Dependency analysis with hotspots
- Data flow diagrams
- Security findings
- Code quality findings
- Onboarding guide
- Suggested improvements
- Mermaid architecture diagrams

## Configuration

Create a JSON config file and pass it with `--config`:

```json
{
  "analysis": {
    "max_depth": 5,
    "exclude_dirs": ["node_modules", ".git"]
  },
  "output": {
    "format": "markdown",
    "verbose": true
  }
}
```

Built-in profiles available in `config/profiles/`:

- `full_analysis.json` — comprehensive analysis
- `quick_scan.json` — fast overview
- `security_focus.json` — security-only scan
