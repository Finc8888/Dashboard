.PHONY: help up down restart logs up-all up-blog up-jobs up-chat quotes open build-auth clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# -- Core (Dashboard + Auth Gateway) --
up: ## Start core services (Dashboard + Auth Gateway)
	docker compose up -d --build

down: ## Stop all services
	docker compose --profile blog --profile jobs --profile chat down

restart: ## Restart core services
	docker compose restart

logs: ## Show logs (follow)
	docker compose --profile blog --profile jobs --profile chat logs -f

# -- All services --
up-all: ## Start ALL services (core + blog + jobs + chat)
	docker compose --profile blog --profile jobs --profile chat up -d --build

# -- Optional profiles --
up-blog: up ## Start core + Gladys Blog
	docker compose --profile blog up -d --build

up-jobs: up ## Start core + Job Statistics
	docker compose --profile blog --profile jobs up -d --build

up-chat: up ## Start core + Gladys Chat
	docker compose --profile chat up -d --build

# -- Utilities --
quotes: ## Parse quotes from markdown
	python3 scripts/parse_quotes.py "$(shell grep QUOTES_FILE .env | cut -d= -f2)" > www/quotes.json

open: ## Open Dashboard in browser
	xdg-open http://localhost:80 2>/dev/null || open http://localhost:80

build-auth: ## Rebuild Auth Gateway
	docker compose build auth-gateway auth-admin

clean: ## Remove all volumes and containers
	docker compose --profile blog --profile jobs --profile chat down -v

status: ## Show status of all services
	docker compose --profile blog --profile jobs --profile chat ps
