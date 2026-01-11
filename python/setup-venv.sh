#!/bin/bash

# Setup Python Virtual Environment for Python Scripts

set -e  # Exit on error

VENV_DIR="$(dirname "$0")/.venv"

# Remove existing venv if it exists
if [ -d "$VENV_DIR" ]; then
    echo -e "Removing existing virtual environment..."
    rm -rf "$VENV_DIR"
fi

# Create virtual environment
echo -e "Creating virtual environment in $VENV_DIR..."
python3 -m venv "$VENV_DIR" --system-site-packages

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo -e "Upgrading pip..."
pip install --upgrade pip

# PyMAVLink
echo -e "Installing pymavlink..."
DISABLE_MAVNATIVE=True pip install pymavlink

