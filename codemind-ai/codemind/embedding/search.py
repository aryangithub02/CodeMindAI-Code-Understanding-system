from typing import Dict, List, Optional
from pathlib import Path
from .vector_store import VectorStore, Chunk


class EmbeddingSearch:
    """Search interface over the vector store."""

    def __init__(self, vector_store: VectorStore):
        self.store = vector_store

    def search_code(self, query: str, top_k: int = 10) -> List[Dict]:
        """Search code chunks by keyword matching (fallback when no embeddings)."""
        query_lower = query.lower()
        results = []

        for chunk in self.store.chunks.values():
            score = 0
            content_lower = chunk.content.lower()

            terms = query_lower.split()
            for term in terms:
                score += content_lower.count(term)

            if score > 0:
                results.append({
                    "chunk_id": chunk.id,
                    "file_path": chunk.file_path,
                    "content": chunk.content[:200],
                    "score": score,
                    "chunk_type": chunk.chunk_type,
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def search_by_file_pattern(self, pattern: str) -> List[Chunk]:
        """Search chunks by file path pattern."""
        pattern_lower = pattern.lower()
        return [
            c for c in self.store.chunks.values()
            if pattern_lower in c.file_path.lower()
        ]

    def search_by_entity_name(self, name: str) -> List[Dict]:
        """Search for a class, function, or variable name in chunks."""
        results = []
        for chunk in self.store.chunks.values():
            if name in chunk.content:
                results.append({
                    "chunk_id": chunk.id,
                    "file_path": chunk.file_path,
                    "content": chunk.content[:300],
                    "name": name,
                })
        return results

    def search_by_metadata(self, key: str, value: Any) -> List[Chunk]:
        return [
            c for c in self.store.chunks.values()
            if c.metadata.get(key) == value
        ]
