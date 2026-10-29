# Development tooling -- NOT a build step.
#
# The site is static (CLAUDE.md, rule 1): nothing here makes or transforms a
# file that is served. `serve` only puts an HTTP server in front of the
# folder, because ES modules do not load from file://.
#
# This file is MANAGED by the make-anim-slides skill: `update` overwrites it.
# The course's own settings and targets go in Makefile.local (PUBLISH, extra
# targets), which is included below and never touched by the skill.

SHELL := /bin/bash

PORT   ?= 9090
REVIEW ?= 7777
PUBLISH ?=
# The class list of the roulette (deck.config.js, rouletteCsv): never published.
ROSTER ?= etudiants.csv
# What ELSE this course never publishes (exam questions, drafts): set it in
# Makefile.local, e.g. EXTRA_EXCLUDES := --exclude 'qcm'
EXTRA_EXCLUDES ?=

-include Makefile.local

# Node walks up to ~/package.json, which declares no "type", and warns at
# every start about a file that does not belong to the project.
NODE := node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON

.PHONY: help serve slides dashboard shots overflow layout strings tp zips \
        publish-dry publish

## Without arguments: the list of targets.
help:
	@echo "make serve        the slides and the review board, together"
	@echo "make slides       the slides alone      (PORT=$(PORT))"
	@echo "make dashboard    the review board alone (REVIEW=$(REVIEW))"
	@echo "make shots LECTURE=00_x.html OUT=dir [SLIDES='3 4']   screenshots"
	@echo "make overflow LECTURE=00_x.html   text running off the slides"
	@echo "make layout LECTURE=00_x.html     overlapping or grazing texts"
	@echo "make strings LECTURE=00_x.html LANG=fr   untranslated strings"
	@echo "make tp           rebuild the practical pages (pandoc)"
	@echo "make zips         rebuild files/tp_*.zip"
	@echo "make publish-dry  what publishing WOULD send (always first)"
	@echo "make publish      send the site to PUBLISH (Makefile.local)"

## Both servers at once. Ctrl-C stops both: they are in the terminal's process
## group, so SIGINT reaches them directly; the trap only returns cleanly. If
## one dies alone (a port already taken), `wait -n` returns at once and the
## other is stopped, rather than leaving half of the setup running.
serve:
	@echo "slides → http://localhost:$(PORT)/"
	@echo "board  → http://localhost:$(REVIEW)/"
	@echo
	@$(NODE) tools/serve.js $(PORT) & s=$$!; \
	 SLIDES_PORT=$(PORT) $(NODE) tools/review/server.js $(REVIEW) & r=$$!; \
	 stop=; trap 'stop=1' INT TERM; \
	 wait -n; code=$$?; \
	 kill $$s $$r 2>/dev/null; wait 2>/dev/null; \
	 if [ -n "$$stop" ] || [ $$code -ge 128 ]; then exit 0; fi; \
	 echo "one of the two servers stopped (port already taken?)" >&2; \
	 exit 1

slides:
	@$(NODE) tools/serve.js $(PORT)

dashboard:
	@SLIDES_PORT=$(PORT) $(NODE) tools/review/server.js $(REVIEW)

## Checks without a screen. They need a server running (`make serve` in
## another terminal) and puppeteer-core (npm install puppeteer-core).
shots:
	@$(NODE) tools/shots.js http://localhost:$(PORT)/$(LECTURE) $(OUT) $(SLIDES)

overflow:
	@$(NODE) tools/overflow.js http://localhost:$(PORT)/$(LECTURE)

layout:
	@$(NODE) tools/layout.js http://localhost:$(PORT)/$(LECTURE)

strings:
	@$(NODE) tools/strings.js http://localhost:$(PORT)/$(LECTURE) --lang $(LANG)

## The practical pages: sources in tp/src/, the output is versioned.
tp:
	@sh tools/tp.sh

zips:
	@sh tools/zips.sh

## Publishing is copying. `--exclude '.*'` keeps out everything hidden (.git,
## .review -- the board, its screenshots and comments -- and the .swp files an
## editor leaves beside the class list, which contain it). `*etudiants*` keeps
## the class list itself out under any name. No --delete: the destination may
## hold other things. `EXTRA_EXCLUDES` (Makefile.local) is the course's own
## list of what must never leave the machine. ALWAYS read the output of
## publish-dry first.
RSYNC_EXCLUDES := --exclude '.*' --exclude 'node_modules' --exclude 'tools' \
                  --exclude '*.md' --exclude '*etudiants*' --exclude 'Makefile' \
                  --exclude 'Makefile.local' --exclude 'package*.json' \
                  --exclude '$(ROSTER)' $(EXTRA_EXCLUDES)

publish-dry:
	@test -n "$(PUBLISH)" || { echo "set PUBLISH in Makefile.local (e.g. host:www/course/)" >&2; exit 1; }
	@rsync -avzn $(RSYNC_EXCLUDES) ./ $(PUBLISH)

publish:
	@test -n "$(PUBLISH)" || { echo "set PUBLISH in Makefile.local (e.g. host:www/course/)" >&2; exit 1; }
	@rsync -avz $(RSYNC_EXCLUDES) ./ $(PUBLISH)
