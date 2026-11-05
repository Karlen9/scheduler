# Build stage
FROM golang:1.26.4-alpine AS builder

WORKDIR /app

# Version injected at build time
ARG VERSION=dev

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Lint: fail if any Go file is not gofmt-formatted
RUN if [ -n "$(gofmt -l .)" ]; then echo "Go files not formatted:"; gofmt -l .; exit 1; fi

# Vet: static analysis
RUN go vet ./...

# Test: run all tests
RUN CGO_ENABLED=1 go test ./...

# Build binary with version injected
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags "-X main.Version=${VERSION}" -o scheduler-bot .

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /app/scheduler-bot .

# Create data directory for SQLite and make it the default, persistent location
RUN mkdir -p /data
ENV DATABASE_PATH=/data/scheduler.db
VOLUME ["/data"]

EXPOSE 8080

CMD ["./scheduler-bot"]
