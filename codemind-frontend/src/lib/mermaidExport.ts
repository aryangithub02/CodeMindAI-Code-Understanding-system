/**
 * Mermaid diagram export utilities.
 *
 * Provides functions to export rendered SVG elements as SVG files or
 * high-resolution PNG images via html-to-image.
 */

import { toPng } from "html-to-image"

/**
 * Serialize an SVG element to a standalone SVG string and return a Blob URL
 * suitable for download.
 */
export function exportSvg(svgElement: SVGElement): string {
  const clone = svgElement.cloneNode(true) as SVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")

  // Inline computed styles so the exported file renders correctly outside the app
  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clone)
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
  return URL.createObjectURL(blob)
}

/**
 * Render an SVG element to a PNG Blob using html-to-image.
 *
 * @param svgElement  The rendered Mermaid SVG element.
 * @param bgColor     Background fill for the PNG (defaults to dark theme background).
 * @param pixelRatio  Device pixel ratio multiplier for high-DPI output.
 */
export async function exportPng(
  svgElement: SVGElement,
  bgColor = "#0F172A",
  pixelRatio = 2
): Promise<Blob> {
  const dataUrl = await toPng(svgElement as unknown as HTMLElement, {
    backgroundColor: bgColor,
    pixelRatio,
    cacheBust: true,
  })

  const res = await fetch(dataUrl)
  return res.blob()
}

/**
 * Trigger a browser download for the given Blob or Blob URL.
 */
export function downloadBlob(blobOrUrl: Blob | string, filename: string): void {
  const url =
    typeof blobOrUrl === "string"
      ? blobOrUrl
      : URL.createObjectURL(blobOrUrl)

  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  // Revoke after a short delay to let the download start
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
