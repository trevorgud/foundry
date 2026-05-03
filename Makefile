COMPOSE_DEV = docker compose -f compose.yml -f compose.dev.yml
TEST_DEPS = test -d node_modules/@playwright/test || npm ci

.PHONY: up down restart logs dev-up dev-restart dev-logs dev-shell configure-world test test-foundry test-foundry-local state screenshot

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose up -d --force-recreate

logs:
	docker compose logs -f foundry

dev-up:
	$(COMPOSE_DEV) up -d foundry

dev-restart:
	$(COMPOSE_DEV) up -d --force-recreate foundry

dev-logs:
	$(COMPOSE_DEV) logs -f foundry

dev-shell:
	$(COMPOSE_DEV) run --rm test bash

configure-world:
	$(COMPOSE_DEV) run --rm test node scripts/configure-foundry.mjs

test: test-foundry

test-foundry:
	$(COMPOSE_DEV) run --rm test sh -lc '$(TEST_DEPS) && npm run test:foundry'

test-foundry-local:
	npm run test:foundry

state:
	$(COMPOSE_DEV) run --rm test sh -lc '$(TEST_DEPS) && npm run foundry:state'

screenshot:
	$(COMPOSE_DEV) run --rm test sh -lc '$(TEST_DEPS) && npm run foundry:screenshot'
