const UNSAFE_OUTPUT_EXTENSIONS = new Set(['desktop', 'url', 'webloc']);

export function getUnsafeOutputFilenameExtension(outputFilename: string) {
  const filename = outputFilename.trim().split(/[\\/]/).pop() || '';
  const extension = filename.match(/\.([^./\\]+)$/)?.[1]?.toLowerCase();

  return extension && UNSAFE_OUTPUT_EXTENSIONS.has(extension) ? extension : null;
}

export function assertSafeOutputFilename(outputFilename: string) {
  const unsafeExtension = getUnsafeOutputFilenameExtension(outputFilename);

  if (unsafeExtension) {
    throw `Output filename cannot end with .${unsafeExtension}. Use .%(ext)s or another media extension.`;
  }
}
