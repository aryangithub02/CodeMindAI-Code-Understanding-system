from typing import Dict, List, Optional, Set, Any, Tuple
from collections import defaultdict
from dataclasses import dataclass, field
from .relations import RelationType, RELATION_LABELS


@dataclass
class Node:
    id: str
    type: str
    label: str
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Edge:
    source: str
    target: str
    relation: RelationType
    properties: Dict[str, Any] = field(default_factory=dict)


class KnowledgeGraph:
    """Represents a repository as a graph of nodes and edges."""

    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []
        self._adjacency: Dict[str, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))

    def add_node(self, node_id: str, node_type: str, label: str = "",
                  properties: Dict[str, Any] = None) -> Node:
        if node_id in self.nodes:
            return self.nodes[node_id]
        node = Node(
            id=node_id,
            type=node_type,
            label=label or node_id.split(".")[-1],
            properties=properties or {},
        )
        self.nodes[node_id] = node
        return node

    def add_edge(self, source: str, target: str, relation: RelationType,
                  properties: Dict[str, Any] = None) -> bool:
        if source not in self.nodes or target not in self.nodes:
            return False
        edge = Edge(
            source=source,
            target=target,
            relation=relation,
            properties=properties or {},
        )
        self.edges.append(edge)
        self._adjacency[source][relation.value].add(target)
        return True

    def get_neighbors(self, node_id: str, relation: Optional[RelationType] = None) -> List[str]:
        if node_id not in self._adjacency:
            return []
        if relation:
            return list(self._adjacency[node_id].get(relation.value, set()))
        result = set()
        for targets in self._adjacency[node_id].values():
            result.update(targets)
        return list(result)

    def get_node(self, node_id: str) -> Optional[Node]:
        return self.nodes.get(node_id)

    def find_path(self, source: str, target: str, max_depth: int = 5) -> List[str]:
        """BFS to find shortest path between two nodes."""
        if source not in self.nodes or target not in self.nodes:
            return []

        visited = {source}
        queue = [(source, [source])]

        while queue:
            current, path = queue.pop(0)
            if current == target:
                return path
            if len(path) >= max_depth:
                continue
            for neighbor in self.get_neighbors(current):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))
        return []

    def get_subgraph(self, node_ids: Set[str], depth: int = 1) -> "KnowledgeGraph":
        """Extract a subgraph centered on given nodes."""
        subgraph = KnowledgeGraph()
        included = set(node_ids)

        current = set(node_ids)
        for _ in range(depth):
            next_level = set()
            for nid in current:
                for neighbor in self.get_neighbors(nid):
                    included.add(neighbor)
                    next_level.add(neighbor)
            current = next_level

        for nid in included:
            if nid in self.nodes:
                node = self.nodes[nid]
                subgraph.add_node(nid, node.type, node.label, node.properties)

        for edge in self.edges:
            if edge.source in included and edge.target in included:
                subgraph.add_edge(edge.source, edge.target, edge.relation, edge.properties)

        return subgraph

    def get_central_nodes(self, top_n: int = 10) -> List[Tuple[str, int]]:
        """Find the most connected nodes by degree centrality."""
        degree = defaultdict(int)
        for edge in self.edges:
            degree[edge.source] += 1
            degree[edge.target] += 1
        return sorted(degree.items(), key=lambda x: x[1], reverse=True)[:top_n]

    def to_dict(self) -> Dict:
        return {
            "nodes": [
                {"id": n.id, "type": n.type, "label": n.label, "properties": n.properties}
                for n in self.nodes.values()
            ],
            "edges": [
                {
                    "source": e.source,
                    "target": e.target,
                    "relation": e.relation.value,
                    "properties": e.properties,
                }
                for e in self.edges
            ],
            "stats": {
                "total_nodes": len(self.nodes),
                "total_edges": len(self.edges),
            },
        }

    def to_mermaid(self) -> str:
        lines = ["graph LR"]
        for edge in self.edges:
            src_label = self.nodes[edge.source].label if edge.source in self.nodes else edge.source
            tgt_label = self.nodes[edge.target].label if edge.target in self.nodes else edge.target
            rel = RELATION_LABELS.get(edge.relation, edge.relation.value)
            lines.append(f"    {src_label} --{rel}--> {tgt_label}")
        return "\n".join(lines)
