#!/usr/bin/env python3
"""
CodeMind AI FastAPI Backend
REST API wrapper for CodeMind repository analysis functionality
"""
import os
import shutil
import uuid
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from codemind.cli import analyze_repository
from codemind.graph import GraphBuilder
from codemind.outputs import (
    Reporter, 
    DiagramGenerator, 
    OnboardingGenerator, 
    DocumentationGenerator,
    AIDocumentationGenerator
)
from codemind.utils.logging_utils import setup_logging

logger = setup_logging()

# Initialize FastAPI app
app = FastAPI(
    title="CodeMind AI API",
    description="Repository Intelligence System API",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage directory for repositories
REPOS_DIR = Path(os.getenv("REPOS_DIR", "/tmp/codemind-repos"))
REPOS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory storage for repository metadata
repositories: Dict[str, Dict[str, Any]] = {}


# Pydantic models
class RepositoryUpload(BaseModel):
    url: str


class ChatMessage(BaseModel):
    repository_id: str
    message: str


class AnalysisRequest(BaseModel):
    repository_id: str
    analysis_type: str = "full"


# Helper functions
def get_repo_path(repo_id: str) -> Path:
    """Get the file system path for a repository"""
    return REPOS_DIR / repo_id


def get_repository(repo_id: str) -> Dict[str, Any]:
    """Get repository metadata by ID"""
    if repo_id not in repositories:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repositories[repo_id]


def analyze_repo_async(repo_id: str, repo_path: Path):
    """Background task to analyze a repository"""
    try:
        logger.info(f"Starting analysis for repository {repo_id}")
        
        # Update status
        repositories[repo_id]["status"] = "analyzing"
        repositories[repo_id]["analysis_started_at"] = datetime.now().isoformat()
        
        # Run analysis
        results = analyze_repository(str(repo_path))
        
        # Store results
        repositories[repo_id]["analysis"] = results
        repositories[repo_id]["status"] = "complete"
        repositories[repo_id]["analysis_completed_at"] = datetime.now().isoformat()
        
        # Extract metadata
        structure = results.get("structure", {})
        metadata = structure.get("metadata", {})
        
        repositories[repo_id].update({
            "name": metadata.get("repository_name", "Unknown"),
            "language": metadata.get("primary_language", "Unknown"),
            "total_files": metadata.get("total_files", 0),
            "total_lines": metadata.get("total_lines", 0),
            "languages": metadata.get("languages", {}),
        })
        
        logger.info(f"Analysis completed for repository {repo_id}")
    except Exception as e:
        logger.error(f"Analysis failed for repository {repo_id}: {e}")
        repositories[repo_id]["status"] = "failed"
        repositories[repo_id]["error"] = str(e)


# API Endpoints

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "CodeMind AI API",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/api/repositories")
async def get_repositories():
    """Get all repositories"""
    return list(repositories.values())


@app.get("/api/repository/{repo_id}")
async def get_repository_endpoint(repo_id: str):
    """Get repository by ID"""
    return get_repository(repo_id)


@app.post("/api/upload")
async def upload_repository(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Upload a repository as a zip file"""
    repo_id = str(uuid.uuid4())
    repo_path = get_repo_path(repo_id)
    repo_path.mkdir(parents=True, exist_ok=True)
    
    # Save uploaded file
    zip_path = repo_path / "upload.zip"
    with open(zip_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Extract zip (simplified - in production use proper zip extraction)
    # For now, we'll assume the repo is already extracted or handle differently
    
    # Create repository entry
    repositories[repo_id] = {
        "id": repo_id,
        "name": file.filename or "Uploaded Repository",
        "url": "",
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "path": str(repo_path),
    }
    
    # Start background analysis
    background_tasks.add_task(analyze_repo_async, repo_id, repo_path)
    
    return repositories[repo_id]


@app.post("/api/upload/url")
async def upload_repository_url(
    background_tasks: BackgroundTasks,
    request: RepositoryUpload
):
    """Upload a repository from a Git URL"""
    import subprocess
    
    repo_id = str(uuid.uuid4())
    repo_path = get_repo_path(repo_id)
    repo_path.mkdir(parents=True, exist_ok=True)
    
    try:
        # Clone repository
        subprocess.run(
            ["git", "clone", request.url, str(repo_path)],
            check=True,
            capture_output=True
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=400, detail=f"Failed to clone repository: {e.stderr}")
    
    # Create repository entry
    repositories[repo_id] = {
        "id": repo_id,
        "name": request.url.split("/")[-1].replace(".git", ""),
        "url": request.url,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "path": str(repo_path),
    }
    
    # Start background analysis
    background_tasks.add_task(analyze_repo_async, repo_id, repo_path)
    
    return repositories[repo_id]


@app.get("/api/repository/{repo_id}/tree")
async def get_file_tree(repo_id: str):
    """Get file tree for a repository"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    structure = analysis.get("structure", {})
    
    # Return file tree from structure analysis
    return structure.get("file_tree", [])


@app.get("/api/repository/{repo_id}/file")
async def get_file_content(repo_id: str, path: str):
    """Get file content"""
    repo = get_repository(repo_id)
    repo_path = Path(repo["path"])
    file_path = repo_path / path
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    content = file_path.read_text(encoding="utf-8", errors="ignore")
    return {"content": content}


@app.delete("/api/repository/{repo_id}")
async def delete_repository(repo_id: str):
    """Delete a repository"""
    if repo_id not in repositories:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Remove from file system
    repo_path = get_repo_path(repo_id)
    if repo_path.exists():
        shutil.rmtree(repo_path)
    
    # Remove from memory
    del repositories[repo_id]
    
    return {"success": True}


@app.get("/api/architecture/{repo_id}")
async def get_architecture(repo_id: str):
    """Get architecture analysis"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    return analysis.get("architecture", {})


@app.get("/api/architecture/{repo_id}/insights")
async def get_architecture_insights(repo_id: str):
    """Get architecture insights"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    architecture = analysis.get("architecture", {})
    
    return {
        "insights": architecture.get("insights", []),
        "summary": architecture.get("summary", ""),
    }


@app.get("/api/architecture/{repo_id}/graph")
async def get_architecture_graph(repo_id: str):
    """Get architecture graph"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    
    builder = GraphBuilder()
    graph = builder.build(
        analysis.get("structure", {}),
        analysis.get("dependencies", {}),
        analysis.get("execution", {}),
        analysis.get("architecture", {}),
    )
    
    return graph.to_dict()


@app.get("/api/architecture/{repo_id}/metrics")
async def get_architecture_metrics(repo_id: str):
    """Get architecture metrics"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    architecture = analysis.get("architecture", {})
    
    return {
        "metrics": architecture.get("metrics", {}),
        "maintainability_score": architecture.get("maintainability_score", 0),
        "complexity": architecture.get("complexity", {}),
    }


@app.get("/api/dataflow/{repo_id}")
async def get_dataflow(repo_id: str):
    """Get data flow analysis"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    execution = analysis.get("execution", {})
    
    return {
        "flow": execution.get("data_flow", []),
        "flowDiagram": execution.get("flow_diagram", ""),
        "sequenceDiagram": execution.get("sequence_diagram", ""),
        "routes": execution.get("api_routes", []),
        "metrics": execution.get("metrics", {}),
        "bottlenecks": execution.get("bottlenecks", []),
    }


@app.get("/api/dataflow/{repo_id}/analysis")
async def get_dataflow_analysis(repo_id: str):
    """Get data flow analysis summary"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    execution = analysis.get("execution", {})
    
    return {
        "summary": execution.get("summary", ""),
        "strengths": execution.get("strengths", []),
        "weaknesses": execution.get("weaknesses", []),
        "risks": execution.get("risks", []),
        "recommendations": execution.get("recommendations", []),
    }


@app.get("/api/dataflow/{repo_id}/journeys")
async def get_dataflow_journeys(repo_id: str):
    """Get data flow journeys"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    execution = analysis.get("execution", {})
    
    return {
        "journeys": execution.get("journeys", []),
    }


@app.get("/api/documentation/{repo_id}")
async def get_documentation(repo_id: str):
    """Get documentation"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    
    generator = DocumentationGenerator()
    docs = generator.generate_all(analysis)
    
    return docs


@app.get("/api/documentation/{repo_id}/sections")
async def get_documentation_sections(repo_id: str):
    """Get documentation sections"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    
    generator = DocumentationGenerator()
    docs = generator.generate_all(analysis)
    
    sections = [
        {"id": key, "title": key.replace("_", " ").title(), "content": content[:200] + "..."}
        for key, content in docs.items()
    ]
    
    return sections


@app.get("/api/documentation/{repo_id}/section/{section_id}")
async def get_documentation_section(repo_id: str, section_id: str):
    """Get specific documentation section"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    
    generator = DocumentationGenerator()
    docs = generator.generate_all(analysis)
    
    if section_id not in docs:
        raise HTTPException(status_code=404, detail="Section not found")
    
    return {"content": docs[section_id]}


@app.get("/api/documentation/{repo_id}/ai")
async def get_ai_documentation(repo_id: str):
    """Get AI-generated documentation"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    
    # This would require an AI API key
    generator = AIDocumentationGenerator()
    ai_content = generator.generate_all_ai_content(analysis)
    
    return ai_content


@app.get("/api/documentation/{repo_id}/build-from-scratch")
async def get_build_from_scratch(repo_id: str):
    """Get build from scratch plan"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    
    # Generate a build plan based on the analysis
    structure = analysis.get("structure", {})
    architecture = analysis.get("architecture", {})
    
    return {
        "title": f"Build {repo.get('name', 'Repository')} from Scratch",
        "steps": [
            {
                "phase": "Setup",
                "tasks": [
                    "Initialize project structure",
                    "Set up development environment",
                    "Configure build tools",
                ]
            },
            {
                "phase": "Core Features",
                "tasks": [
                    f"Implement {architecture.get('type', 'core')} architecture",
                    "Set up data models",
                    "Implement business logic",
                ]
            },
            {
                "phase": "Integration",
                "tasks": [
                    "Connect external services",
                    "Set up API endpoints",
                    "Configure database",
                ]
            },
        ],
        "tech_stack": structure.get("metadata", {}).get("languages", {}),
    }


@app.get("/api/onboarding/{repo_id}")
async def get_onboarding(repo_id: str, days: int = 5):
    """Get onboarding plan"""
    repo = get_repository(repo_id)
    analysis = repo.get("analysis", {})
    
    generator = OnboardingGenerator(repo_name=repo.get("name", "Unknown"))
    plan = generator.generate(analysis, days=days)
    
    return {"plan": plan}


@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    total_repos = len(repositories)
    completed = sum(1 for r in repositories.values() if r.get("status") == "complete")
    failed = sum(1 for r in repositories.values() if r.get("status") == "failed")
    
    return {
        "totalRepositories": total_repos,
        "completedAnalyses": completed,
        "failedAnalyses": failed,
        "pendingAnalyses": total_repos - completed - failed,
    }


@app.post("/chat")
async def chat(message: ChatMessage):
    """Send a chat message"""
    # This would integrate with an AI service
    return {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": f"I received your message about repository {message.repository_id}. AI chat integration requires an API key.",
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/chat/stream")
async def chat_stream(message: ChatMessage):
    """Send a chat message with streaming response"""
    # This would integrate with an AI service with streaming
    return {
        "message": "Streaming chat requires AI API integration",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
