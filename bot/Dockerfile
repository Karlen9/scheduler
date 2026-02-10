# Build stage
FROM golang:1.24-alpine AS builder

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

# Build binary with version injected
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags "-X main.Version=${VERSION}" -o scheduler-bot .

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /app/scheduler-bot .

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 8080

CMD ["./scheduler-bot"]
