# Entry points for working on the calculator. `make` lists them.

FRONTEND := frontend
BACKEND  := backend
IMAGE    := fullstack-calculator

.DEFAULT_GOAL := help

.PHONY: help
help: ## List the available targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-z0-9-]+:.*## / {printf "  \033[36m%-13s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: setup
setup: ## Install dependencies and the Playwright browser
	cd $(FRONTEND) && npm ci && npx playwright install chromium

.PHONY: dev
dev: ## Run the API on :8080 and the Vite dev server on :5173, with hot reload
	@$(MAKE) -j2 dev-backend dev-frontend

.PHONY: dev-backend
dev-backend:
	cd $(BACKEND) && LOG_FORMAT=text go run ./cmd/server

.PHONY: dev-frontend
dev-frontend:
	cd $(FRONTEND) && npm run dev

.PHONY: build
build: ## Build the frontend bundle and the server binary
	cd $(FRONTEND) && npm run build
	cd $(BACKEND) && CGO_ENABLED=0 go build -trimpath -o bin/server ./cmd/server

.PHONY: run
run: build ## Serve the built app from the Go binary on :8080, as in production
	cd $(BACKEND) && STATIC_DIR=../$(FRONTEND)/dist LOG_FORMAT=text ./bin/server

.PHONY: test
test: ## Run the backend and frontend unit tests
	cd $(BACKEND) && go test -race ./...
	cd $(FRONTEND) && npm test

.PHONY: coverage
coverage: ## Write coverage reports to backend/coverage.html and frontend/coverage/
	cd $(BACKEND) && go test -race -coverprofile=coverage.out ./... \
		&& go tool cover -func=coverage.out | tail -1 \
		&& go tool cover -html=coverage.out -o coverage.html
	cd $(FRONTEND) && npm run coverage

.PHONY: lint
lint: ## Lint, format-check and type-check both apps
	cd $(BACKEND) && golangci-lint run
	cd $(FRONTEND) && npm run lint && npm run typecheck && npm run format:check

.PHONY: fmt
fmt: ## Format both apps
	cd $(BACKEND) && golangci-lint fmt
	cd $(FRONTEND) && npm run format

.PHONY: fuzz
fuzz: ## Fuzz the calculator for 30 seconds
	cd $(BACKEND) && go test -run='^$$' -fuzz=FuzzCalculate -fuzztime=30s ./internal/calculator

.PHONY: e2e
e2e: ## Run the Playwright suite against the real server
	cd $(FRONTEND) && npm run e2e

.PHONY: screenshots
screenshots: ## Regenerate the README screenshots
	cd $(FRONTEND) && npm run screenshots

.PHONY: docker-build
docker-build: ## Build the production image
	docker build -t $(IMAGE) .

.PHONY: docker-run
docker-run: docker-build ## Run the production image on :8080
	docker run --rm -p 8080:8080 $(IMAGE)

.PHONY: clean
clean: ## Remove build and test output
	rm -rf $(BACKEND)/bin $(BACKEND)/coverage.out $(BACKEND)/coverage.html
	rm -rf $(FRONTEND)/dist $(FRONTEND)/coverage $(FRONTEND)/test-results $(FRONTEND)/playwright-report
