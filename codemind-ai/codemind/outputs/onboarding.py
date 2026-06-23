from typing import Dict, List, Optional


class OnboardingGenerator:
    """Generates structured onboarding plans for new developers."""

    def __init__(self, repo_name: str = "Unknown"):
        self.repo_name = repo_name

    def generate(self, analysis: Dict, days: int = 5) -> str:
        metadata = analysis.get("structure", {}).get("metadata", {})
        entries = analysis.get("structure", {}).get("entry_points", [])
        layers = analysis.get("structure", {}).get("layers", {})
        hotspots = analysis.get("dependencies", {}).get("hotspots", [])
        routes = analysis.get("execution", {}).get("routes", [])
        frameworks = analysis.get("architecture", {}).get("frameworks", {})

        plan = f"# Onboarding Guide: {self.repo_name}\n\n"
        plan += self._day_1(entries, layers)
        if days >= 2:
            plan += self._day_2(frameworks, hotspots, routes)
        if days >= 3:
            plan += self._day_3(analysis)
        if days >= 4:
            plan += self._day_4()
        if days >= 5:
            plan += self._day_5(analysis)

        plan += "\n## Resources\n\n"
        plan += "- Project repository\n"
        plan += "- Architecture documentation\n"
        plan += "- Coding standards document\n"
        plan += "- Style guide\n"

        return plan

    def _day_1(self, entries: List[Dict], layers: Dict[str, str]) -> str:
        text = "## Day 1: Foundation\n\n"
        text += "### Goals\n"
        text += "- Understand the repository structure\n"
        text += "- Set up local development environment\n"
        text += "- Learn the tech stack\n\n"

        text += "### Activities\n\n"
        text += "1. **Repository Overview**\n"
        text += "   - Clone the repository\n"
        text += "   - Review the directory structure\n"
        if layers:
            text += "   - Identify architecture layers:\n"
            for path, layer in layers.items():
                text += f"     - `{path}` → {layer}\n"

        if entries:
            text += "\n2. **Entry Points**\n"
            text += "   - Locate and read entry point files:\n"
            for e in entries[:3]:
                text += f"     - `{e['path']}` ({e['type']})\n"

        text += "\n3. **Setup**\n"
        text += "   - Install dependencies\n"
        text += "   - Configure environment variables\n"
        text += "   - Run the application locally\n"
        text += "   - Verify it starts without errors\n"

        return text

    def _day_2(self, frameworks: Dict[str, str], hotspots: List[Dict], routes: List[Dict]) -> str:
        text = "## Day 2: Core Architecture\n\n"
        text += "### Goals\n"
        text += "- Understand the framework(s) in use\n"
        text += "- Learn the critical modules\n"
        text += "- Understand the API layer\n\n"

        text += "### Activities\n\n"
        text += "1. **Framework Familiarity**\n"
        for fw, path in frameworks.items():
            text += f"   - **{fw}** — configured/referenced in `{path}`\n"
        text += "   - Review official documentation\n"

        if hotspots:
            text += "\n2. **Critical Modules**\n"
            text += "   - Study these highly-referenced modules:\n"
            for h in hotspots[:5]:
                text += f"     - `{h['module']}` ({h['referenced_by']} dependents)\n"

        if routes:
            text += "\n3. **API Endpoints**\n"
            text += "   - Review route definitions\n"
            for r in routes[:8]:
                text += f"     - `[{r['method']}] {r['path']}` — `{r['file']}`\n"

        return text

    def _day_3(self, analysis: Dict) -> str:
        persistence = analysis.get("persistence", {}).get("summary", {})
        cycles = analysis.get("dependencies", {}).get("circular_dependencies", [])
        external = analysis.get("dependencies", {}).get("external_dependencies", [])

        text = "## Day 3: Data & Dependencies\n\n"
        text += "### Goals\n"
        text += "- Understand the data layer\n"
        text += "- Understand external integrations\n"
        text += "- Trace a complete request lifecycle\n\n"

        text += "### Activities\n\n"
        text += "1. **Database Layer**\n"
        text += f"   - Primary ORM: {persistence.get('primary_orm', 'Unknown')}\n"
        text += f"   - Model files detected: {persistence.get('total_model_files', 0)}\n"

        if external:
            text += "\n2. **External Dependencies**\n"
            for ext in sorted(external)[:10]:
                text += f"   - `{ext}`\n"

        text += "\n3. **Request Lifecycle**\n"
        text += "   ```\n"
        text += "   User → Router → Middleware → Controller → Service → Repository → DB\n"
        text += "   ```\n"

        if cycles:
            text += f"\n4. **Circular Dependencies (watch for these):**\n"
            for cycle in cycles[:3]:
                text += f"   - {' → '.join(cycle)}\n"

        return text

    def _day_4(self) -> str:
        text = "## Day 4: Testing & Quality\n\n"
        text += "### Goals\n"
        text += "- Understand the testing strategy\n"
        text += "- Learn how to run tests\n"
        text += "- Understand CI/CD pipeline\n\n"

        text += "### Activities\n\n"
        text += "1. **Testing**\n"
        text += "   - Find test files and understand the test structure\n"
        text += "   - Run the existing test suite\n"
        text += "   - Write a simple test for a core function\n"

        text += "\n2. **Code Quality**\n"
        text += "   - Review code style guide / linter configuration\n"
        text += "   - Run linter and formatter\n"

        text += "\n3. **CI/CD**\n"
        text += "   - Review CI/CD configuration\n"
        text += "   - Understand the deployment pipeline\n"
        text += "   - Review infrastructure as code (if applicable)\n"

        return text

    def _day_5(self, analysis: Dict) -> str:
        text = "## Day 5: Contributions\n\n"
        text += "### Goals\n"
        text += "- Pick up a small task\n"
        text += "- Understand the PR workflow\n"
        text += "- Make your first contribution\n\n"

        text += "### Activities\n\n"
        text += "1. **First Task**\n"
        text += "   - Find a good first issue or small bug fix\n"
        text += "   - Discuss approach with the team\n"
        text += "   - Implement the fix\n"

        text += "\n2. **Pull Request**\n"
        text += "   - Create a feature branch\n"
        text += "   - Commit changes with meaningful messages\n"
        text += "   - Open a pull request\n"
        text += "   - Respond to review feedback\n"

        text += "\n3. **Review Process**\n"
        text += "   - Review someone else's PR\n"
        text += "   - Understand the merge process\n"

        return text
