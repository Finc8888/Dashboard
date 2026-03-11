-include .env
export

QUOTES_OUT = www/quotes.json

.PHONY: up down restart logs open quotes

quotes:
ifdef QUOTES_FILE
	python3 scripts/parse_quotes.py "$(QUOTES_FILE)" "$(QUOTES_OUT)"
else
	@echo "⚠  QUOTES_FILE не задан в .env — баннер цитат будет скрыт"
endif

up: quotes
	docker compose up -d
	@echo "Dashboard: http://localhost:8080"

down:
	docker compose down

restart:
	docker compose restart dashboard

logs:
	docker compose logs -f dashboard

open:
	xdg-open http://localhost:8080 2>/dev/null || open http://localhost:8080 2>/dev/null || echo "Открой: http://localhost:8080"
