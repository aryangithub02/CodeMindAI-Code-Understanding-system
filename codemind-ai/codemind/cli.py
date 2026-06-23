#!/usr/bin/env python3
import argparse
import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional

from .config import Config
from .analyzer import (
    StructureAnalyzer,
    DependencyAnalyzer,
    ExecutionAnalyzer,
    PersistenceAnalyzer,
    ArchitectureAnalyzer,
    SecurityAnalyzer,
    QualityAnalyzer,
    PerformanceAnalyzer,
)
from .graph import GraphBuilder, KnowledgeGraph
from .outputs import Reporter, DiagramGenerator, OnboardingGenerator, DocumentationGenerator, AIDocumentationGenerator
from .utils.logging_utils import setup_logging

logger = setup_logging()


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codemind",
        description="CodeMind AI — Repository Intelligence System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  codemind analyze /path/to/repo
  codemind analyze /path/to/repo --output report.md --format markdown
  codemind analyze /path/to/repo --profile quick_scan
  codemind graph /path/to/repo --output dependency_graph.json
  codemind security /path/to/repo
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # analyze
    analyze_parser = subparsers.add_parser("analyze", help="Run full repository analysis")
    analyze_parser.add_argument("path", type=str, help="Path to the repository")
    analyze_parser.add_argument("--output", "-o", type=str, default=None, help="Output file path")
    analyze_parser.add_argument("--format", "-f", type=str, default="markdown", choices=["markdown", "json"], help="Output format")
    analyze_parser.add_argument("--config", "-c", type=str, default=None, help="Configuration file path")
    analyze_parser.add_argument("--profile", "-p", type=str, default=None, help="Analysis profile")

    # graph
    graph_parser = subparsers.add_parser("graph", help="Generate dependency/knowledge graph")
    graph_parser.add_argument("path", type=str, help="Path to the repository")
    graph_parser.add_argument("--output", "-o", type=str, default=None, help="Output file path")
    graph_parser.add_argument("--format", "-f", type=str, default="mermaid", choices=["mermaid", "json"], help="Output format")

    # security
    security_parser = subparsers.add_parser("security", help="Run security scan")
    security_parser.add_argument("path", type=str, help="Path to the repository")
    security_parser.add_argument("--output", "-o", type=str, default=None, help="Output file path")

    # quality
    quality_parser = subparsers.add_parser("quality", help="Run code quality analysis")
    quality_parser.add_argument("path", type=str, help="Path to the repository")
    quality_parser.add_argument("--output", "-o", type=str, default=None, help="Output file path")

    # onboarding
    onboarding_parser = subparsers.add_parser("onboarding", help="Generate onboarding guide")
    onboarding_parser.add_argument("path", type=str, help="Path to the repository")
    onboarding_parser.add_argument("--output", "-o", type=str, default=None, help="Output file path")
    onboarding_parser.add_argument("--days", type=int, default=5, help="Number of days for the onboarding plan")

    # doc
    doc_parser = subparsers.add_parser("doc", help="Generate documentation")
    doc_parser.add_argument("path", type=str, help="Path to the repository")
    doc_parser.add_argument("--type", "-t", type=str, default="all", choices=["all", "overview", "architecture", "api", "service", "services", "database", "dependencies", "dataflow", "setup", "deployment", "ai_guide"], help="Documentation type")
    doc_parser.add_argument("--output", "-o", type=str, default=None, help="Output file path")
    doc_parser.add_argument("--ai", action="store_true", help="Include AI-generated content (requires OpenRouter API key)")

    # summary
    summary_parser = subparsers.add_parser("summary", help="Quick repository summary")
    summary_parser.add_argument("path", type=str, help="Path to the repository")

    return parser


def analyze_repository(path: str, config: Optional[Config] = None) -> Dict[str, Any]:
    """Run all analyzers and return combined results."""
    logger.info(f"Analyzing repository: {path}")
    root = Path(path).resolve()

    if not root.exists():
        logger.error(f"Path does not exist: {path}")
        sys.exit(1)

    results = {}

    logger.info("Analyzing structure...")
    structure = StructureAnalyzer(str(root))
    results["structure"] = structure.analyze()

    logger.info("Analyzing dependencies...")
    deps = DependencyAnalyzer(str(root))
    results["dependencies"] = deps.analyze()

    logger.info("Analyzing execution paths...")
    exec_analyzer = ExecutionAnalyzer(str(root))
    results["execution"] = exec_analyzer.analyze()

    logger.info("Analyzing persistence layer...")
    persistence = PersistenceAnalyzer(str(root))
    results["persistence"] = persistence.analyze()

    logger.info("Detecting architecture...")
    arch = ArchitectureAnalyzer(str(root))
    results["architecture"] = arch.analyze()

    logger.info("Scanning for security issues...")
    security = SecurityAnalyzer(str(root))
    results["security"] = security.analyze()

    logger.info("Analyzing code quality...")
    quality = QualityAnalyzer(str(root))
    results["quality"] = quality.analyze()

    logger.info("Analyzing performance...")
    perf = PerformanceAnalyzer(str(root))
    results["performance"] = perf.analyze()

    return results


def cmd_analyze(args):
    config = Config(args.config) if args.config else Config()
    results = analyze_repository(args.path, config)

    if args.format == "json":
        output = json.dumps(results, indent=2, default=str)
    else:
        reporter = Reporter()
        output = reporter.generate_report(results, report_type=config.get("output.report_type", "full"))

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        logger.info(f"Report written to {out_path}")
    else:
        print(output)


def cmd_graph(args):
    results = analyze_repository(args.path)
    builder = GraphBuilder()
    graph = builder.build(
        results["structure"],
        results["dependencies"],
        results["execution"],
        results["architecture"],
    )

    if args.format == "json":
        output = json.dumps(graph.to_dict(), indent=2, default=str)
    else:
        output = graph.to_mermaid()

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        logger.info(f"Graph written to {out_path}")
    else:
        print(output)


def cmd_security(args):
    results = analyze_repository(args.path)
    security = results.get("security", {})

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(security, indent=2, default=str), encoding="utf-8")
        logger.info(f"Security report written to {out_path}")
    else:
        print(json.dumps(security, indent=2, default=str))


def cmd_quality(args):
    results = analyze_repository(args.path)
    quality = results.get("quality", {})

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(quality, indent=2, default=str), encoding="utf-8")
        logger.info(f"Quality report written to {out_path}")
    else:
        print(json.dumps(quality, indent=2, default=str))


def cmd_onboarding(args):
    results = analyze_repository(args.path)
    metadata = results.get("structure", {}).get("metadata", {})
    generator = OnboardingGenerator(repo_name=metadata.get("repository_name", "Unknown"))
    output = generator.generate(results, days=args.days)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        logger.info(f"Onboarding guide written to {out_path}")
    else:
        print(output)


def cmd_doc(args):
    results = analyze_repository(args.path)
    generator = DocumentationGenerator()
    ai_generator = AIDocumentationGenerator() if args.ai else None

    doc_type_map = {
        "overview": generator.generate_repository_overview,
        "architecture": generator.generate_architecture_doc,
        "api": generator.generate_api_doc,
        "service": generator.generate_service_doc,
        "services": generator.generate_service_doc,
        "database": generator.generate_database_doc,
        "dependencies": generator.generate_dependency_doc,
        "dataflow": generator.generate_dataflow_doc,
        "setup": generator.generate_setup_doc,
        "deployment": generator.generate_deployment_doc,
        "ai_guide": generator.generate_ai_guide,
    }

    if args.type == "all":
        all_docs = generator.generate_all(results)
        output = ""
        for key, content in all_docs.items():
            output += f"\n\n{'='*60}\n{content}\n"
            if ai_generator and key in ("overview", "architecture"):
                ai_content = ai_generator.generate_all_ai_content(results)
                output += f"\n## AI Analysis\n\n{ai_content.get(key, '')}\n"

        output = output.strip()
    else:
        func = doc_type_map.get(args.type)
        if func:
            output = func(results)
            if ai_generator and args.type in ("overview", "architecture"):
                ai_content = ai_generator.generate_all_ai_content(results)
                output += f"\n\n## AI Analysis\n\n{ai_content.get(args.type, '')}\n"
        else:
            logger.error(f"Unknown doc type: {args.type}")
            return

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        logger.info(f"Documentation written to {out_path}")
    else:
        print(output)


def cmd_summary(args):
    root = Path(args.path).resolve()
    if not root.exists():
        logger.error(f"Path does not exist: {args.path}")
        sys.exit(1)

    structure = StructureAnalyzer(str(root))
    metadata = structure.get_metadata()
    layers = structure.detect_layers()
    entries = structure.find_entry_points()

    print(f"\n{'='*50}")
    print(f"  CodeMind AI — Repository Summary")
    print(f"{'='*50}")
    print(f"  Repository: {metadata.get('repository_name', 'N/A')}")
    print(f"  Files: {metadata.get('total_files', 0)}")
    print(f"  Lines: {metadata.get('total_lines', 0)}")
    print(f"  Languages: {len(metadata.get('languages', {}))}")
    print()

    if layers:
        print("  Layers:")
        for path, layer in layers.items():
            print(f"    {layer}: {path}")
    print()

    if entries:
        print("  Entry Points:")
        for e in entries:
            print(f"    [{e['type']}] {e['path']}")
    print(f"{'='*50}\n")


COMMAND_MAP = {
    "analyze": cmd_analyze,
    "graph": cmd_graph,
    "security": cmd_security,
    "quality": cmd_quality,
    "onboarding": cmd_onboarding,
    "doc": cmd_doc,
    "summary": cmd_summary,
}


def main():
    parser = create_parser()
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    command_fn = COMMAND_MAP.get(args.command)
    if command_fn:
        command_fn(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
