from typing import Dict, List, Set, Tuple, Any
from collections import defaultdict


class GraphUtils:
    """Utility functions for graph analysis."""

    @staticmethod
    def topological_sort(graph: Dict[str, List[str]]) -> List[str]:
        """Returns a topological ordering of the dependency graph."""
        in_degree = defaultdict(int)
        for node in graph:
            in_degree[node] = in_degree.get(node, 0)
            for neighbor in graph[node]:
                in_degree[neighbor] = in_degree.get(neighbor, 0) + 1

        queue = [node for node, degree in in_degree.items() if degree == 0]
        result = []

        while queue:
            node = queue.pop(0)
            result.append(node)
            for neighbor in graph.get(node, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(result) != len(graph):
            remaining = set(graph.keys()) - set(result)
            result.extend(remaining)

        return result

    @staticmethod
    def find_all_paths(graph: Dict[str, List[str]], start: str, end: str,
                        max_depth: int = 10) -> List[List[str]]:
        """Find all paths between start and end nodes (DFS with limit)."""
        paths = []
        visited = set()

        def dfs(current: str, path: List[str]):
            if len(path) > max_depth:
                return
            if current == end:
                paths.append(path.copy())
                return
            visited.add(current)
            for neighbor in graph.get(current, []):
                if neighbor not in visited:
                    path.append(neighbor)
                    dfs(neighbor, path)
                    path.pop()
            visited.discard(current)

        dfs(start, [start])
        return paths

    @staticmethod
    def find_strongly_connected_components(graph: Dict[str, List[str]]) -> List[Set[str]]:
        """Find SCCs using Kosaraju's algorithm."""
        visited = set()
        stack = []

        def dfs(node: str):
            visited.add(node)
            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor)
            stack.append(node)

        for node in graph:
            if node not in visited:
                dfs(node)

        reversed_graph = defaultdict(list)
        for node, neighbors in graph.items():
            for neighbor in neighbors:
                reversed_graph[neighbor].append(node)

        visited.clear()
        sccs = []

        def reverse_dfs(node: str, component: set):
            visited.add(node)
            component.add(node)
            for neighbor in reversed_graph.get(node, []):
                if neighbor not in visited:
                    reverse_dfs(neighbor, component)

        for node in reversed(stack):
            if node not in visited:
                component = set()
                reverse_dfs(node, component)
                sccs.append(component)

        return sccs

    @staticmethod
    def calculate_coupling(graph: Dict[str, List[str]]) -> Dict[str, float]:
        """Calculate coupling score for each module."""
        coupling = {}
        total_nodes = len(graph)
        if total_nodes == 0:
            return coupling

        for node in graph:
            fan_in = sum(1 for s in graph if node in graph.get(s, []))
            fan_out = len(graph.get(node, []))
            coupling[node] = (fan_in + fan_out) / max(total_nodes, 1)

        return coupling

    @staticmethod
    def find_hotspots(graph: Dict[str, List[str]], top_n: int = 10) -> List[Tuple[str, int]]:
        """Find modules with highest incoming dependency count."""
        incoming = defaultdict(int)
        for source, targets in graph.items():
            for target in targets:
                incoming[target] += 1
        return sorted(incoming.items(), key=lambda x: x[1], reverse=True)[:top_n]
