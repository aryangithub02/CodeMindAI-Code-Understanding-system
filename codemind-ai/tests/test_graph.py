import pytest
from codemind.graph.knowledge_graph import KnowledgeGraph
from codemind.graph.relations import RelationType


def test_add_node():
    graph = KnowledgeGraph()
    graph.add_node("user", "file", "User")
    assert "user" in graph.nodes
    assert graph.nodes["user"].label == "User"


def test_add_edge():
    graph = KnowledgeGraph()
    graph.add_node("a", "module", "A")
    graph.add_node("b", "module", "B")
    assert graph.add_edge("a", "b", RelationType.IMPORTS)
    assert "b" in graph.get_neighbors("a")


def test_edge_without_nodes():
    graph = KnowledgeGraph()
    assert not graph.add_edge("x", "y", RelationType.DEPENDS_ON)


def test_get_neighbors():
    graph = KnowledgeGraph()
    graph.add_node("a", "module", "A")
    graph.add_node("b", "module", "B")
    graph.add_node("c", "module", "C")
    graph.add_edge("a", "b", RelationType.IMPORTS)
    graph.add_edge("a", "c", RelationType.CALLS)
    neighbors = graph.get_neighbors("a")
    assert len(neighbors) == 2
    calls = graph.get_neighbors("a", RelationType.CALLS)
    assert "c" in calls


def test_find_path():
    graph = KnowledgeGraph()
    for n in ["a", "b", "c", "d"]:
        graph.add_node(n, "module", n.upper())
    graph.add_edge("a", "b", RelationType.DEPENDS_ON)
    graph.add_edge("b", "c", RelationType.DEPENDS_ON)
    graph.add_edge("c", "d", RelationType.DEPENDS_ON)
    path = graph.find_path("a", "d")
    assert path == ["a", "b", "c", "d"]


def test_no_path():
    graph = KnowledgeGraph()
    graph.add_node("a", "module", "A")
    graph.add_node("z", "module", "Z")
    assert graph.find_path("a", "z") == []


def test_central_nodes():
    graph = KnowledgeGraph()
    for n in ["a", "b", "c"]:
        graph.add_node(n, "module", n.upper())
    graph.add_edge("a", "b", RelationType.IMPORTS)
    graph.add_edge("c", "b", RelationType.IMPORTS)
    central = graph.get_central_nodes()
    assert central[0][0] == "b"


def test_to_mermaid():
    graph = KnowledgeGraph()
    graph.add_node("mod_a", "module", "ModuleA")
    graph.add_node("mod_b", "module", "ModuleB")
    graph.add_edge("mod_a", "mod_b", RelationType.IMPORTS)
    mermaid = graph.to_mermaid()
    assert "graph LR" in mermaid
    assert "ModuleA" in mermaid
    assert "ModuleB" in mermaid
