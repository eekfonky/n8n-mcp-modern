#!/bin/bash
set -euo pipefail

# n8n-MCP-Modern Deployment Script
# This script handles deployment of the MCP server

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"
DOCKER_COMPOSE="${PROJECT_ROOT}/docker-compose.yml"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 22 ]; then
        log_error "Node.js 22+ is required (found v${NODE_VERSION})"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        log_info "Docker detected - container deployment available"
        DOCKER_AVAILABLE=true
    else
        log_warn "Docker not found - only local deployment available"
        DOCKER_AVAILABLE=false
    fi
}

setup_environment() {
    log_info "Setting up environment..."
    
    # Check for .env file
    if [ ! -f "$ENV_FILE" ]; then
        log_warn ".env file not found, creating from example..."
        if [ -f "${ENV_FILE}.example" ]; then
            cp "${ENV_FILE}.example" "$ENV_FILE"
            chmod 600 "$ENV_FILE"
            log_warn "Please edit .env file with your configuration"
            exit 1
        else
            log_error ".env.example not found"
            exit 1
        fi
    fi
    
    # Secure .env file permissions
    chmod 600 "$ENV_FILE"
    log_info "Environment file secured"
}

install_dependencies() {
    log_info "Installing dependencies..."
    cd "$PROJECT_ROOT"
    npm ci --production
}

build_application() {
    log_info "Building application..."
    cd "$PROJECT_ROOT"
    npm run build
}

validate_configuration() {
    log_info "Validating configuration..."
    
    # Source environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check n8n connection if configured
    if [ -n "${N8N_API_URL:-}" ] && [ -n "${N8N_API_KEY:-}" ]; then
        log_info "Testing n8n API connection..."
        if npx tsx test-n8n-connection.ts > /dev/null 2>&1; then
            log_info "n8n API connection successful"
        else
            log_warn "n8n API connection failed - check your credentials"
        fi
    else
        log_warn "n8n API not configured - running in standalone mode"
    fi
    
    # Validate database
    log_info "Validating database..."
    npm run validate || log_warn "Database validation failed - will rebuild"
}

deploy_local() {
    log_info "Deploying locally..."
    
    # Create required directories
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/data"
    
    # Set permissions
    chmod 750 "$PROJECT_ROOT/logs"
    chmod 750 "$PROJECT_ROOT/data"
    
    # Create systemd service (if on Linux)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_info "Creating systemd service..."
        sudo tee /etc/systemd/system/n8n-mcp.service > /dev/null <<EOF
[Unit]
Description=n8n MCP Modern Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_ROOT
ExecStart=/usr/bin/node $PROJECT_ROOT/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:$PROJECT_ROOT/logs/n8n-mcp.log
StandardError=append:$PROJECT_ROOT/logs/n8n-mcp-error.log
Environment="NODE_ENV=production"
EnvironmentFile=$ENV_FILE

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable n8n-mcp
        sudo systemctl start n8n-mcp
        log_info "Service started - check status with: systemctl status n8n-mcp"
    else
        log_info "Starting application..."
        npm start
    fi
}

deploy_docker() {
    log_info "Deploying with Docker..."
    
    # Build Docker image
    log_info "Building Docker image..."
    docker build -t n8n-mcp-modern:latest "$PROJECT_ROOT"
    
    # Start containers
    log_info "Starting containers..."
    docker-compose -f "$DOCKER_COMPOSE" up -d
    
    # Show status
    docker-compose -f "$DOCKER_COMPOSE" ps
    log_info "Containers started - check logs with: docker-compose logs -f"
}

# Main execution
main() {
    log_info "n8n-MCP-Modern Deployment Script"
    log_info "================================="
    
    # Parse arguments
    DEPLOYMENT_TYPE="${1:-local}"
    
    # Run checks
    check_requirements
    setup_environment
    
    # Install and build
    install_dependencies
    build_application
    validate_configuration
    
    # Deploy based on type
    case "$DEPLOYMENT_TYPE" in
        local)
            deploy_local
            ;;
        docker)
            if [ "$DOCKER_AVAILABLE" = true ]; then
                deploy_docker
            else
                log_error "Docker is not available"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            log_info "Usage: $0 [local|docker]"
            exit 1
            ;;
    esac
    
    log_info "Deployment complete!"
}

# Run main function
main "$@"