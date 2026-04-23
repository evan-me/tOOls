/**
 * 在新窗口中打开图片查看器
 * @param {string} src - 图片地址（data URL / http URL 等）
 * @param {string} [alt] - 图片标题
 */
export function openImageViewer(src, alt = "") {
  if (!src) return;
  if (window.api?.openImageViewer) {
    window.api.openImageViewer(src, alt);
  }
}
