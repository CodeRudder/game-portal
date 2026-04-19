#!/bin/bash
# Check container runtime availability
echo "=== Checking Docker ==="
which docker 2>&1 && docker --version 2>&1 || echo "Docker NOT found"

echo ""
echo "=== Checking Podman ==="
which podman 2>&1 && podman --version 2>&1 || echo "Podman NOT found"

echo ""
echo "=== Checking npm/node ==="
which node 2>&1 && node --version 2>&1 || echo "Node NOT found"
which npm 2>&1 && npm --version 2>&1 || echo "npm NOT found"
