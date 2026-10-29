#!/bin/sh
# Build the archives the practical pages hand out.
#
#   sh tools/zips.sh
#
# The sources live in tp/, versioned; the zips are what the site serves, so
# they are rebuilt from the sources rather than edited. Run this after
# touching anything under tp/tp_*.
#
# The answers (tp/tp_*/\*_correction.py) stay out of the archives: they are
# versioned beside the exercises, but the students get the exercises.
set -e
cd "$(dirname "$0")/.."
mkdir -p files
for dir in tp/tp_*; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  find "$dir" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
  rm -f "files/$name.zip"
  (cd tp && zip -q -r "../files/$name.zip" "$name" \
      -x '*/__pycache__/*' -x '*_correction.py')
  echo "files/$name.zip  $(du -h "files/$name.zip" | cut -f1)"
done
