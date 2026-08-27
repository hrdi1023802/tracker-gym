/** Descarga un archivo generado en el navegador. */
export function downloadFile(data: Uint8Array | string, fileName: string, mimeType: string): void {
  const blob = data instanceof Uint8Array
    ? new Blob([data.slice().buffer as ArrayBuffer], { type: mimeType })
    : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
