from typing import Dict, List, Optional, Any


class DiagramGenerator:
    """Generates Mermaid.js diagrams from analysis results."""

    @staticmethod
    def architecture_diagram(layers: Dict[str, str], routes: List[Dict]) -> str:
        lines = ["graph TD"]
        seen = set()

        prev_node = None
        for path, layer in layers.items():
            node_id = layer.replace(" ", "_").replace("/", "_")
            label = layer
            if node_id not in seen:
                lines.append(f"    {node_id}[{label}]")
                seen.add(node_id)
            if prev_node:
                lines.append(f"    {prev_node} --> {node_id}")
            prev_node = node_id

        if not layers:
            lines.append("    Client[Client]")
            lines.append("    API[API Layer]")
            lines.append("    Service[Service Layer]")
            lines.append("    DB[(Database)]")
            lines.append("    Client --> API")
            lines.append("    API --> Service")
            lines.append("    Service --> DB")

        return "\n".join(lines)

    @staticmethod
    def dependency_diagram(dep_graph: Dict[str, List[str]]) -> str:
        lines = ["graph LR"]
        for source, targets in dep_graph.items():
            src_id = source.replace(".", "_").replace("/", "_").replace("-", "_")
            src_label = source.split("/")[-1].split(".")[0]
            lines.append(f"    {src_id}[{src_label}]")
            for target in targets:
                tgt_id = target.replace(".", "_").replace("/", "_").replace("-", "_")
                tgt_label = target.split("/")[-1].split(".")[0]
                lines.append(f"    {tgt_id}[{tgt_label}]")
                lines.append(f"    {src_id} --> {tgt_id}")
        return "\n".join(lines)

    @staticmethod
    def sequence_diagram(routes: List[Dict]) -> str:
        lines = [
            "sequenceDiagram",
            "    participant User",
            "    participant API",
            "    participant Service",
            "    participant DB",
            "",
            "    User->>API: HTTP Request",
            "    API->>Service: Process Request",
            "    Service->>DB: Query/Write",
            "    DB-->>Service: Result",
            "    Service-->>API: Response Data",
            "    API-->>User: HTTP Response",
        ]

        if routes:
            route = routes[0] if routes else {}
            method = route.get("method", "GET")
            path = route.get("path", "/")
            lines.insert(5, f"    Note over API: {method} {path}")

        return "\n".join(lines)

    @staticmethod
    def class_diagram(classes: List[Dict]) -> str:
        lines = ["classDiagram"]
        for cls in classes:
            name = cls["name"]
            lines.append(f"    class {name} {{")
            for method in cls.get("methods", []):
                lines.append(f"        +{method}()")
            lines.append("    }")

            if cls.get("bases"):
                for base in cls["bases"]:
                    lines.append(f"    {name} --> {base}")

            if cls.get("extends"):
                lines.append(f"    {name} --|> {cls['extends']}")

            if cls.get("implements"):
                for iface in cls["implements"]:
                    lines.append(f"    {name} ..|> {iface}")

        return "\n".join(lines)

    @staticmethod
    def flow_diagram(flow_steps: List[str]) -> str:
        lines = ["graph TD"]
        for i, step in enumerate(flow_steps):
            node_id = f"S{i}"
            clean = step.replace('"', "'").replace("→", "->")
            label = clean[:50]
            lines.append(f"    {node_id}[\"{label}\"]")
            if i > 0:
                lines.append(f"    S{i - 1} --> {node_id}")
        return "\n".join(lines)

    @staticmethod
    def circular_dependency_diagram(cycles: List[List[str]]) -> str:
        lines = ["graph TD"]
        for i, cycle in enumerate(cycles):
            subgraph = [f"    subgraph Cycle_{i}"]
            for j, node in enumerate(cycle):
                nid = f"C{i}_{j}"
                subgraph.append(f"        {nid}[{node}]")
            for j in range(len(cycle) - 1):
                subgraph.append(f"        C{i}_{j} --> C{i}_{j+1}")
            subgraph.append("    end")
            lines.extend(subgraph)
        return "\n".join(lines)
