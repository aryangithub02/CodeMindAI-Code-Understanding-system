import { jsPDF } from "jspdf"

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function inlineFormat(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code style='background:#eee;padding:1px 5px;border-radius:3px;font-size:11px'>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
}

function sectionToHtml(sectionName: string, markdown: string): string {
  const codeBlocks: string[] = []
  let processed = markdown.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m: string, lang: string, code: string) => {
      const idx = codeBlocks.length
      const langAttr = lang ? ` class="language-${lang}"` : ""
      codeBlocks.push(
        `<pre style="background:#eee;padding:10px;border-radius:4px;font-size:10px;line-height:1.4;margin:10px 0;white-space:pre-wrap;word-break:break-word"><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`
      )
      return `\n\n\x01CB${idx}\x01\n\n`
    }
  )

  const blocks = processed.split(/\n{2,}/)
  const htmls: string[] = []

  htmls.push(
    `<h2 style="font-size:18px;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #444;color:#111">${escapeHtml(sectionName)}</h2>`
  )

  for (const block of blocks) {
    const t = block.trim()
    if (!t) continue

    const cb = t.match(/^\x01CB(\d+)\x01$/)
    if (cb) {
      htmls.push(codeBlocks[parseInt(cb[1])])
      continue
    }

    // heading
    if (/^#{1,3}\s/.test(t)) {
      const m = t.match(/^(#{1,3})\s+(.+)$/m)!
      const lvl = m[1].length
      const sizes = ["", "font-size:20px;margin:18px 0 10px;color:#111", "font-size:16px;margin:14px 0 8px;color:#222", "font-size:14px;margin:10px 0 6px;color:#333"]
      htmls.push(`<h${lvl} style="${sizes[lvl]}">${inlineFormat(escapeHtml(m[2]))}</h${lvl}>`)
      continue
    }

    // hr
    if (/^-{3,}$/.test(t)) {
      htmls.push('<hr style="border:none;border-top:1px solid #ccc;margin:14px 0">')
      continue
    }

    // table
    if (t.includes("|") && t.split("\n").every((l) => l.trim().includes("|"))) {
      const rows = t.split("\n").filter((l) => l.trim())
      let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0">'
      let isHead = true
      for (const row of rows) {
        const r = row.trim()
        if (/^\|[\s:-]+\|$/.test(r) || /^[\s:-]+$/.test(r.replace(/\|/g, ""))) {
          isHead = false; continue
        }
        const cells = r.split("|").filter(Boolean).map((c) => inlineFormat(escapeHtml(c.trim())))
        const tag = isHead ? "th" : "td"
        html += `<tr>${cells.map((c) => `<${tag} style="border:1px solid #ccc;padding:4px 8px;font-size:10px;text-align:left">${c}</${tag}>`).join("")}</tr>`
      }
      html += "</table>"
      htmls.push(html)
      continue
    }

    // ul
    if (/^[-*]\s/.test(t)) {
      const items = t
        .split("\n")
        .filter((l) => /^[-*]\s/.test(l.trim()))
        .map((l) => `<li style="margin:3px 0">${inlineFormat(escapeHtml(l.trim().replace(/^[-*]\s+/, "")))}</li>`)
      htmls.push(`<ul style="margin:8px 0;padding-left:22px">${items.join("")}</ul>`)
      continue
    }

    // ol
    if (/^\d+\.\s/.test(t)) {
      const items = t
        .split("\n")
        .filter((l) => /^\d+\.\s/.test(l.trim()))
        .map((l) => `<li style="margin:3px 0">${inlineFormat(escapeHtml(l.trim().replace(/^\d+\.\s+/, "")))}</li>`)
      htmls.push(`<ol style="margin:8px 0;padding-left:22px">${items.join("")}</ol>`)
      continue
    }

    // paragraph
    htmls.push(`<p style="margin:8px 0;font-size:11px;line-height:1.5">${inlineFormat(escapeHtml(t))}</p>`)
  }

  return htmls.join("\n")
}

export async function exportDocsPdf(
  docs: Record<string, string>,
  repoName: string
): Promise<void> {
  const pageW = 210
  const pageH = 297
  const margin = 15

  // Build the full HTML document
  const container = document.createElement("div")
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1000px;background:#fff;z-index:-1;font-family:sans-serif;padding:15px 20px;color:#111;line-height:1.6;font-size:12px"

  let inner = `<h1 style="font-size:24px;margin:0 0 4px;color:#000">${escapeHtml(repoName)}</h1>`
  inner += `<p style="font-size:12px;color:#666;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #333">Auto-generated Documentation</p>`

  for (const [key, val] of Object.entries(docs)) {
    const sectionName = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    inner += sectionToHtml(sectionName, val)
  }

  container.innerHTML = inner
  document.body.appendChild(container)

  // Wait for layout to settle
  await new Promise((r) => requestAnimationFrame(r))
  await new Promise((r) => setTimeout(r, 50))

  try {
    const mod = await import("html2canvas")
    const html2canvas = mod.default
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: container.scrollWidth,
      height: container.scrollHeight,
    })

    const doc = new jsPDF("p", "mm", "a4")
    const usableW = pageW - margin * 2
    const usableH = pageH - margin * 2
    const ratio = canvas.width / usableW
    const totalImgH = canvas.height / ratio

    if (totalImgH <= usableH) {
      const imgData = canvas.toDataURL("image/jpeg", 0.95)
      doc.addImage(imgData, "JPEG", margin, margin, usableW, totalImgH)
    } else {
      const pageCanvasH = usableH * ratio
      const totalPages = Math.ceil(canvas.height / pageCanvasH)

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) doc.addPage()

        const srcY = i * pageCanvasH
        const sliceH = Math.min(pageCanvasH, canvas.height - srcY)
        const pageCanvas = document.createElement("canvas")
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceH

        const ctx = pageCanvas.getContext("2d")!
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95)
        const imgH = sliceH / ratio
        doc.addImage(imgData, "JPEG", margin, margin, usableW, imgH)
      }
    }

    doc.save(`${repoName}-documentation.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
