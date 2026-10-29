#!/bin/sh
# Rebuild the practical subject pages from their markdown sources.
#
#   sh tools/tp.sh
#
# Each tp/src/<name>.md becomes tp_<name>.html at the root of the site,
# dressed by tools/tp.tpl: the head of the site, its fonts, its theme switch
# and its animated background. Pandoc marks up the code tokens; the palette
# that colours them is in tp.css. The outputs are versioned: the site stays
# servable as it is, with no build step.
#
# Paths in the markdown are written relative to tp/ (figures/..., videos/...,
# files/tp_<x>/...) and rewritten here to where they live from the root.
set -e
cd "$(dirname "$0")/.."
for src in tp/src/*.md; do
  [ -f "$src" ] || continue
  out="tp_$(basename "$src" .md)"
  pandoc "$src" -f markdown+raw_html+tex_math_single_backslash -t html --mathjax \
         --template tools/tp.tpl -o "$out.html"
  sed -i -e 's|"figures/|"tp/figures/|g' \
         -e 's|"videos/|"tp/videos/|g' \
         -e 's|"files/tp_\([a-z0-9_]*\)/|"tp/tp_\1/|g' "$out.html"
  echo "$out.html"
done
