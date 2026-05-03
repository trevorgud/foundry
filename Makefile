PLAYWRIGHT_IMAGE ?= mcr.microsoft.com/playwright:v1.59.1-noble
PLAYWRIGHT_DOCKER = docker run --rm --network host -e NPM_CONFIG_UPDATE_NOTIFIER=false -v "$(PWD)":/work -w /work $(PLAYWRIGHT_IMAGE)

.PHONY: up down restart logs configure-world test test-foundry test-foundry-local state screenshot

up:
	docker compose up -d

down:
	docker compose down

restart: configure-world
	docker compose up -d --force-recreate

logs:
	docker compose logs -f foundry

configure-world:
	npm run foundry:configure-world

test: test-foundry

test-foundry:
	$(PLAYWRIGHT_DOCKER) npm run test:foundry

test-foundry-local:
	npm run test:foundry

state:
	$(PLAYWRIGHT_DOCKER) npm run foundry:state

screenshot:
	$(PLAYWRIGHT_DOCKER) npm run foundry:screenshot
