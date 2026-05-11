.PHONY: help up down restart logs up-all up-blog up-jobs up-chat up-sketchbook quotes open build-auth clean jobs-migrate jobs-seed jobs-test jobs-lint sketch-migrate test test-coverage

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# -- Core (Dashboard + Auth Gateway) --
up: ## Start core services (Dashboard + Auth Gateway)
	docker compose up -d --build

down: ## Stop all services
	docker compose --profile blog --profile jobs --profile chat --profile sketchbook down

restart: ## Restart core services
	docker compose restart

logs: ## Show logs (follow)
	docker compose --profile blog --profile jobs --profile chat --profile sketchbook logs -f

# -- All services --
up-all: ## Start ALL services (core + blog + jobs + chat + sketchbook)
	docker compose --profile blog --profile jobs --profile chat --profile sketchbook up -d --build

# -- Optional profiles --
up-blog: up ## Start core + Gladys Blog
	docker compose --profile blog up -d --build

up-jobs: up ## Start core + Job Statistics
	docker compose --profile blog --profile jobs up -d --build

up-chat: up ## Start core + Gladys Chat
	docker compose --profile chat up -d --build

up-sketchbook: up ## Start core + Sketchbook
	docker compose --profile sketchbook up -d --build

# -- Utilities --
quotes: ## Parse quotes from markdown
	python3 scripts/parse_quotes.py "$(shell grep QUOTES_FILE .env | cut -d= -f2)" > www/quotes.json

open: ## Open Dashboard in browser
	xdg-open http://localhost:80 2>/dev/null || open http://localhost:80

build-auth: ## Rebuild Auth Gateway
	docker compose build auth-gateway auth-admin

build-blog: ## Rebuild Blog Admin
	docker compose --profile blog build blog-admin

jobs-migrate: ## Apply Job Statistics DB migrations
	@echo "🔧 Applying Job Statistics migrations..."
	@for f in ../job-statistics-platform/backend/migrations/0*_*.sql; do \
		[ "$$(basename $$f)" = "002_seed_data.sql" ] && continue; \
		echo "  → $$(basename $$f)"; \
		docker exec -i job-stats-db mysql --default-character-set=utf8mb4 -u $${JOBS_DB_USER:-jobuser} -p$${JOBS_DB_PASSWORD:-jobpassword} $${JOBS_DB_NAME:-job_stats} < "$$f"; \
	done
	@echo "✅ Job Statistics migrations applied"

jobs-seed: ## ⚠️  Load Job Statistics test data (destructive!)
	@echo "⚠️  Loading seed data — all Job Statistics tables will be truncated!"
	docker exec -i job-stats-db mysql --default-character-set=utf8mb4 -u $${JOBS_DB_USER:-jobuser} -p$${JOBS_DB_PASSWORD:-jobpassword} $${JOBS_DB_NAME:-job_stats} \
		< ../job-statistics-platform/backend/migrations/002_seed_data.sql
	@echo "✅ Job Statistics seed data loaded"

JOBS_FRONTEND_DIR := ../job-statistics-platform/frontend

jobs-test: ## Run Job Statistics frontend tests (Jest)
	docker build -t job-stats-frontend-test -f $(JOBS_FRONTEND_DIR)/Dockerfile.test $(JOBS_FRONTEND_DIR)
	docker run --rm job-stats-frontend-test yarn test

jobs-test-coverage: ## Run Job Statistics frontend tests with coverage
	docker build -t job-stats-frontend-test -f $(JOBS_FRONTEND_DIR)/Dockerfile.test $(JOBS_FRONTEND_DIR)
	docker run --rm job-stats-frontend-test yarn test:coverage

jobs-lint: ## Run Job Statistics frontend linter (ESLint)
	docker build -t job-stats-frontend-test -f $(JOBS_FRONTEND_DIR)/Dockerfile.test $(JOBS_FRONTEND_DIR)
	docker run --rm job-stats-frontend-test yarn lint

jobs-lint-fix: ## Run Job Statistics frontend linter with auto-fix
	docker build -t job-stats-frontend-test -f $(JOBS_FRONTEND_DIR)/Dockerfile.test $(JOBS_FRONTEND_DIR)
	docker run --rm -v $(shell realpath $(JOBS_FRONTEND_DIR)/src):/app/src job-stats-frontend-test yarn lint:fix

jobs-test-backend: ## Run Job Statistics backend unit tests (Go)
	cd ../job-statistics-platform/backend && go test ./... -v -count=1

jobs-rebuild: ## Rebuild Job Statistics (API + Frontend)
	docker compose --profile jobs build --no-cache job-stats-api job-stats-frontend
	docker compose --profile jobs up -d job-stats-api job-stats-frontend

jobs-rebuild-api: ## Rebuild Job Statistics API only
	docker compose --profile jobs build --no-cache job-stats-api
	docker compose --profile jobs up -d job-stats-api

jobs-rebuild-frontend: ## Rebuild Job Statistics Frontend only
	docker compose --profile jobs build --no-cache job-stats-frontend
	docker compose --profile jobs up -d job-stats-frontend

jobs-logs: ## Show Job Statistics logs
	docker compose --profile jobs logs -f job-stats-api job-stats-frontend

chat-rebuild: ## Rebuild Gladys Chat (API + Frontend)
	docker compose --profile chat build --no-cache gladys-chat-api gladys-chat-frontend
	docker compose --profile chat up -d gladys-chat-api gladys-chat-frontend

chat-rebuild-api: ## Rebuild Gladys Chat API only
	docker compose --profile chat build --no-cache gladys-chat-api
	docker compose --profile chat up -d gladys-chat-api

chat-rebuild-frontend: ## Rebuild Gladys Chat Frontend only
	docker compose --profile chat build --no-cache gladys-chat-frontend
	docker compose --profile chat up -d gladys-chat-frontend

chat-migrate: ## Apply Gladys Chat DB migrations
	@echo "Applying Gladys Chat migrations..."
	@for f in ../Gladys-Chat/backend/migrations/0*_*.sql; do \
		echo "  → $$(basename $$f)"; \
		docker exec -i gladys-chat-db mysql --default-character-set=utf8mb4 -u gladys -pgladyspassword gladys_chat < "$$f"; \
	done
	@echo "Gladys Chat migrations applied"

chat-logs: ## Show Gladys Chat logs
	docker compose --profile chat logs -f gladys-chat-api gladys-chat-frontend

sketch-migrate: ## Apply Sketchbook DB migrations
	@echo "Applying Sketchbook migrations..."
	docker exec -i sketchbook-db mysql --default-character-set=utf8mb4 -u sketchuser -psketchpassword sketchbook \
		< ../sketchbook/backend/migrations/001_create_tables.sql
	@echo "Sketchbook migrations applied"

# -- Dashboard UI Tests --
test: ## Run Dashboard UI tests (Jest)
	docker build -t dashboard-ui-test -f tests/Dockerfile .
	docker run --rm -e FORCE_COLOR=1 dashboard-ui-test npm test

test-coverage: ## Run Dashboard UI tests with coverage
	docker build -t dashboard-ui-test -f tests/Dockerfile .
	docker run --rm -e FORCE_COLOR=1 dashboard-ui-test npm run test:coverage

clean: ## Remove all volumes and containers
	docker compose --profile blog --profile jobs --profile chat --profile sketchbook down -v

status: ## Show status of all services
	docker compose --profile blog --profile jobs --profile chat --profile sketchbook ps
