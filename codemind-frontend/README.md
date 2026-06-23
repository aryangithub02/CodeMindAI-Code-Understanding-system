This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Mermaid Diagrams

The project includes a reusable `MermaidDiagram` component for rendering flowcharts, sequence diagrams, architecture diagrams, and more using [Mermaid.js](https://mermaid.js.org/).

### Usage

```tsx
import { MermaidDiagram } from "@/components/mermaid-diagram"

<MermaidDiagram
  diagram={`flowchart TD
    A[Start] --> B[End]`}
  title="My Diagram"
/>
```

### Features

| Feature | Description |
|---------|-------------|
| **SVG Export** | Download the rendered diagram as a standalone SVG file |
| **PNG Export** | High-DPI PNG export via `html-to-image` with theme-aware background |
| **Zoom** | In-toolbar zoom controls (40 %–250 %) with smooth CSS transitions |
| **Theme Toggle** | Switch between dark and light Mermaid themes per-diagram |
| **Live Editing** | On the Data Flow page, click **Edit Source** to modify diagram markup and see changes instantly |
| **Lazy Loading** | The component is dynamically imported (`next/dynamic`) to keep the initial bundle small |

### Export Utilities

Low-level helpers are available in `src/lib/mermaidExport.ts`:

```ts
import { exportSvg, exportPng, downloadBlob } from "@/lib/mermaidExport"

// SVG
const url = exportSvg(svgElement)
downloadBlob(url, "diagram.svg")

// PNG (async, returns a Blob)
const blob = await exportPng(svgElement, "#0F172A", 2)
downloadBlob(blob, "diagram.png")
```
