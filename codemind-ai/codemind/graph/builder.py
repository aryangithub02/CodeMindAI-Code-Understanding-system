import re
from pathlib import Path
from typing import Dict, List, Optional
from .knowledge_graph import KnowledgeGraph
from .relations import RelationType


class GraphBuilder:
    """Builds a knowledge graph from repository analysis results."""

    def __init__(self):
        self.graph = KnowledgeGraph()

    def build(self, structure_result: Dict, dep_result: Dict,
              exec_result: Dict, arch_result: Dict) -> KnowledgeGraph:
        self._add_files(structure_result)
        self._add_dependencies(dep_result)
        self._add_routes(exec_result)
        self._add_architecture(arch_result)
        return self.graph

    def _add_files(self, structure: Dict):
        metadata = structure.get("metadata", {})
        self.graph.add_node(
            node_id=f"repo:{metadata.get('repository_name', 'unknown')}",
            node_type="repository",
            label=metadata.get("repository_name", "Unknown"),
            properties=metadata,
        )

        tree = structure.get("tree", [])
        self._add_tree_nodes(tree, parent_id=None)

    def _add_tree_nodes(self, entries: List[Dict], parent_id: Optional[str],
                        path: str = ""):
        for entry in entries:
            name = entry["name"]
            current_path = f"{path}/{name}" if path else name

            node_type = "directory" if entry["type"] == "directory" else "file"
            node_id = f"file:{current_path}"

            self.graph.add_node(node_id=node_id, node_type=node_type, label=name)

            if parent_id:
                self.graph.add_edge(parent_id, node_id, RelationType.CONTAINS)

            if "children" in entry:
                self._add_tree_nodes(entry["children"], node_id, current_path)

    def _add_dependencies(self, dep_result: Dict):
        dep_graph = dep_result.get("dependency_graph", {})
        for source, targets in dep_graph.items():
            source_id = f"file:{source}"
            self.graph.add_node(source_id, "file", label=Path(source).name)

            for target in targets:
                target_id = f"file:{target}"
                self.graph.add_node(target_id, "file", label=Path(target).name)
                self.graph.add_edge(source_id, target_id, RelationType.IMPORTS)

    def _add_routes(self, exec_result: Dict):
        routes = exec_result.get("routes", [])
        for route in routes:
            route_id = f"route:{route['method']}:{route['path']}"
            self.graph.add_node(
                node_id=route_id,
                node_type="route",
                label=f"{route['method']} {route['path']}",
                properties={"method": route["method"], "path": route["path"]},
            )
            file_id = f"file:{route['file']}"
            self.graph.add_edge(file_id, route_id, RelationType.ROUTES_TO)

    def _add_architecture(self, arch_result: Dict):
        architectures = arch_result.get("architecture_style", [])
        for arch in architectures:
            arch_id = f"arch:{arch['architecture'].lower().replace(' ', '_')}"
            self.graph.add_node(
                node_id=arch_id,
                node_type="architecture_pattern",
                label=arch["architecture"],
                properties={"score": arch["score"]},
            )
