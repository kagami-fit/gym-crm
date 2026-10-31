/** iPad で撮った写真は大きいので、長い辺2000pxの JPEG に小さくしてから送る（読めなければそのまま送る）。ブラウザの中でだけ使う */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 1_200_000) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}
