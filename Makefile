# Makefile — shortcuts for the PhyslibSearch indexing pipeline.
#
# Before running these commands, export the following variables
# (or add them to your shell profile):
#
#   export DBNAME=physlibsearch
#   export INDEXED_REPO_PATH=/path/to/physlib
#   export MODULE_NAMES=Physlib,QuantumInfo
#   export CHROMA_PATH=chroma

check_env:
	@test -n "$(DBNAME)"            || (echo "Please set DBNAME"            && exit 1)
	@test -n "$(INDEXED_REPO_PATH)" || (echo "Please set INDEXED_REPO_PATH" && exit 1)
	@test -n "$(MODULE_NAMES)"      || (echo "Please set MODULE_NAMES"      && exit 1)
	@test -n "$(CHROMA_PATH)"       || (echo "Please set CHROMA_PATH"       && exit 1)

# Drop and recreate the database, clear ChromaDB, rebuild the Lean project.
reset: check_env
	@echo "\n==> Dropping and recreating PostgreSQL database '$(DBNAME)'..."
	-dropdb $(DBNAME)
	createdb $(DBNAME)
	@echo "\n==> Clearing ChromaDB files..."
	rm -rf $(CHROMA_PATH)
	@echo "\n==> Cleaning and rebuilding Lean project..."
	cd $(INDEXED_REPO_PATH) && lake clean && lake build
	cd $(INDEXED_REPO_PATH) && rm -rf ./.jixia
	@echo "\n==> Creating database schema..."
	python3 -m database schema
	@echo "\n==> Done."

# Parse Lean source with jixia and populate PostgreSQL.
jixia: reset
	@echo "\n==> Parsing project with jixia..."
	python3 -m database jixia $(INDEXED_REPO_PATH) $(MODULE_NAMES)

# Generate informal (natural-language) descriptions via Gemini.
informal: jixia
	@echo "\n==> Generating informal descriptions with Gemini..."
	python3 -m database informal

# Create vector embeddings via Gemini and store in ChromaDB.
index: informal
	@echo "\n==> Creating embeddings with Gemini..."
	python3 -m database vector-db
