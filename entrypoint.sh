#!/bin/sh
set -eu

YT_DLP_BIN_DIR="${YT_DLP_BIN_DIR:-/tmp/yt-dlp-bin}"
YT_DLP_BIN="${YT_DLP_BIN_DIR}/yt-dlp"
YT_DLP_DOWNLOAD_URL="${YT_DLP_DOWNLOAD_URL:-https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp}"

mkdir -p "${YT_DLP_BIN_DIR}"

echo "Updating yt-dlp from ${YT_DLP_DOWNLOAD_URL}"
if wget -q "${YT_DLP_DOWNLOAD_URL}" -O "${YT_DLP_BIN}.tmp"; then
  chmod a+rx "${YT_DLP_BIN}.tmp"
  mv "${YT_DLP_BIN}.tmp" "${YT_DLP_BIN}"
  echo "yt-dlp updated: $(${YT_DLP_BIN} --version)"
else
  rm -f "${YT_DLP_BIN}.tmp"
  if [ -x "${YT_DLP_BIN}" ]; then
    echo "Failed to update yt-dlp; using existing binary: $(${YT_DLP_BIN} --version)"
  elif command -v yt-dlp >/dev/null 2>&1; then
    echo "Failed to update yt-dlp; using bundled binary: $(yt-dlp --version)"
  else
    echo "Failed to download yt-dlp and no existing binary is available." >&2
    exit 1
  fi
fi

export PATH="${YT_DLP_BIN_DIR}:${PATH}"

exec "$@"
