from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import hashlib


@dataclass
class Chunk:
    id: str
    file_path: str
    content: str
    chunk_type: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None


class VectorStore:
    """In-memory vector store for code chunks and embeddings."""

    def __init__(self):
        self.chunks: Dict[str, Chunk] = {}
        self.dimensions: int = 0

    def add_chunk(self, file_path: str, content: str, chunk_type: str = "code",
                   metadata: Dict[str, Any] = None,
                   embedding: Optional[List[float]] = None) -> str:
        chunk_id = hashlib.md5(f"{file_path}:{content[:100]}".encode()).hexdigest()
        chunk = Chunk(
            id=chunk_id,
            file_path=file_path,
            content=content,
            chunk_type=chunk_type,
            metadata=metadata or {},
            embedding=embedding,
        )
        self.chunks[chunk_id] = chunk
        if embedding and self.dimensions == 0:
            self.dimensions = len(embedding)
        return chunk_id

    def get_chunk(self, chunk_id: str) -> Optional[Chunk]:
        return self.chunks.get(chunk_id)

    def search_similar(self, query_embedding: List[float], top_k: int = 10) -> List[Dict]:
        """Return top-k chunks by cosine similarity."""
        if not self.dimensions:
            return []

        results = []
        for chunk_id, chunk in self.chunks.items():
            if chunk.embedding:
                similarity = self._cosine_similarity(query_embedding, chunk.embedding)
                results.append({
                    "chunk_id": chunk_id,
                    "file_path": chunk.file_path,
                    "content": chunk.content[:200],
                    "similarity": similarity,
                    "chunk_type": chunk.chunk_type,
                })

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

    def search_by_file(self, file_path: str) -> List[Chunk]:
        return [c for c in self.chunks.values() if c.file_path == file_path]

    def search_by_type(self, chunk_type: str) -> List[Chunk]:
        return [c for c in self.chunks.values() if c.chunk_type == chunk_type]

    def delete_chunk(self, chunk_id: str) -> bool:
        if chunk_id in self.chunks:
            del self.chunks[chunk_id]
            return True
        return False

    def clear(self):
        self.chunks.clear()
        self.dimensions = 0

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        if len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def stats(self) -> Dict:
        return {
            "total_chunks": len(self.chunks),
            "dimensions": self.dimensions,
            "file_count": len(set(c.file_path for c in self.chunks.values())),
            "chunk_types": {
                t: sum(1 for c in self.chunks.values() if c.chunk_type == t)
                for t in set(c.chunk_type for c in self.chunks.values())
            },
        }
