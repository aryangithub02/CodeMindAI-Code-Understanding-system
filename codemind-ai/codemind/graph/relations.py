from enum import Enum


class RelationType(Enum):
    CALLS = "CALLS"
    USES = "USES"
    IMPORTS = "IMPORTS"
    EXTENDS = "EXTENDS"
    IMPLEMENTS = "IMPLEMENTS"
    DEPENDS_ON = "DEPENDS_ON"
    QUERIES = "QUERIES"
    WRITES_TO = "WRITES_TO"
    READS_FROM = "READS_FROM"
    CONTAINS = "CONTAINS"
    ROUTES_TO = "ROUTES_TO"
    INJECTS = "INJECTS"
    COMPOSES = "COMPOSES"
    AGGREGATES = "AGGREGATES"
    OWNS = "OWNS"


RELATION_LABELS = {
    RelationType.CALLS: "calls",
    RelationType.USES: "uses",
    RelationType.IMPORTS: "imports",
    RelationType.EXTENDS: "extends",
    RelationType.IMPLEMENTS: "implements",
    RelationType.DEPENDS_ON: "depends on",
    RelationType.QUERIES: "queries",
    RelationType.WRITES_TO: "writes to",
    RelationType.READS_FROM: "reads from",
    RelationType.CONTAINS: "contains",
    RelationType.ROUTES_TO: "routes to",
    RelationType.INJECTS: "injects",
    RelationType.COMPOSES: "composes",
    RelationType.AGGREGATES: "aggregates",
    RelationType.OWNS: "owns",
}
