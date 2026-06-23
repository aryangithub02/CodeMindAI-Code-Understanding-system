import json
import os
from typing import Dict, Optional, Any
from datetime import date

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


class AIDocumentationGenerator:
    """Generates AI-powered documentation using OpenRouter API."""

    def __init__(self, api_key: Optional[str] = None, model: str = "deepseek/deepseek-chat-v3"):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.model = model
        self.client = None
        if OpenAI and self.api_key:
            self.client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.api_key,
                default_headers={
                    "HTTP-Referer": "https://codemind.ai",
                    "X-Title": "CodeMind AI",
                },
            )

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        if not self.client:
            return "AI generation unavailable. Configure OpenRouter API key in Settings."
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=2000,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"AI generation error: {e}"

    def generate_repository_summary(self, analysis: Dict) -> str:
        meta = analysis.get("structure", {}).get("metadata", {})
        arch = analysis.get("architecture", {})
        frameworks = arch.get("frameworks", {})
        hotspots = analysis.get("dependencies", {}).get("hotspots", [])
        routes = analysis.get("execution", {}).get("routes", [])

        context = json.dumps({
            "name": meta.get("repository_name", "Unknown"),
            "files": meta.get("total_files", 0),
            "lines": meta.get("total_lines", 0),
            "languages": list(meta.get("languages", {}).keys()),
            "frameworks": list(frameworks.keys()),
            "top_modules": [h["module"] for h in hotspots[:5]],
            "routes_count": len(routes),
        }, indent=2)

        return self._call_llm(
            "You are a technical documentation expert. Generate a concise repository summary.",
            f"Analyze this repository data and provide:\n"
            f"1. Repository purpose (what it does)\n"
            f"2. Architecture overview\n"
            f"3. Key components\n"
            f"4. Recommendations\n\n"
            f"Repository data:\n{context}"
        )

    def generate_architecture_explanation(self, analysis: Dict) -> str:
        arch = analysis.get("architecture", {})
        styles = arch.get("architecture_style", [])
        patterns = arch.get("patterns", [])
        layers = analysis.get("structure", {}).get("layers", {})
        frameworks = arch.get("frameworks", {})

        context = json.dumps({
            "architecture_styles": styles[:3],
            "design_patterns": [p["pattern"] for p in patterns[:5]],
            "layers": layers,
            "frameworks": frameworks,
        }, indent=2)

        return self._call_llm(
            "You are an architecture expert. Explain the architecture of this codebase.",
            f"Analyze this architecture data and provide:\n"
            f"1. Architecture type and pattern explanation\n"
            f"2. Layer responsibilities\n"
            f"3. Strengths of the architecture\n"
            f"4. Potential risks\n\n"
            f"Architecture data:\n{context}"
        )

    def generate_component_explanation(self, module_name: str, module_data: Dict) -> str:
        context = json.dumps(module_data, indent=2)
        return self._call_llm(
            "You are a code documentation expert. Explain this component.",
            f"Explain the purpose and functionality of this component:\n{context}"
        )

    def generate_onboarding_content(self, analysis: Dict) -> str:
        meta = analysis.get("structure", {}).get("metadata", {})
        arch = analysis.get("architecture", {})
        frameworks = arch.get("frameworks", {})
        layers = analysis.get("structure", {}).get("layers", {})
        hotspots = analysis.get("dependencies", {}).get("hotspots", [])
        routes = analysis.get("execution", {}).get("routes", [])
        entries = analysis.get("structure", {}).get("entry_points", [])

        context = json.dumps({
            "name": meta.get("repository_name"),
            "files": meta.get("total_files"),
            "lines": meta.get("total_lines"),
            "frameworks": list(frameworks.keys()),
            "layers": list(layers.values()),
            "entry_points": [e["path"] for e in entries[:3]],
            "core_modules": [h["module"] for h in hotspots[:5]],
            "api_routes": len(routes),
        }, indent=2)

        return self._call_llm(
            "You are a developer onboarding specialist. Create a helpful onboarding guide.",
            f"Based on this repository data, create a developer onboarding guide covering:\n"
            f"1. First steps to understand the codebase\n"
            f"2. Key files to read first\n"
            f"3. Development workflow\n"
            f"4. Common pitfalls\n\n"
            f"Repository data:\n{context}"
        )

    def generate_all_ai_content(self, analysis: Dict) -> Dict[str, str]:
        return {
            "summary": self.generate_repository_summary(analysis),
            "architecture": self.generate_architecture_explanation(analysis),
            "onboarding": self.generate_onboarding_content(analysis),
            "generated_at": date.today().isoformat(),
        }
