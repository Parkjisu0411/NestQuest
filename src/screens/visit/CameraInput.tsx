/** Native WebView and supporting mobile browsers launch the rear camera for capture. */
export function CameraInput({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  return <label className="file-action">사진 촬영
    <input aria-label="사진 촬영" type="file" accept="image/*" capture="environment" onChange={(event) => { onFiles(event.target.files); event.target.value = '' }} />
  </label>
}
