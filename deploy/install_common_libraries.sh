#!/bin/bash

set -e
set -x

## General Packages
sudo apt update
sudo apt upgrade -y
sudo apt install -y gstreamer1.0-plugins-good libgstrtspserver-1.0-0 gir1.2-gst-rtsp-server-1.0 gstreamer1.0-plugins-base-apps gstreamer1.0-plugins-ugly gstreamer1.0-plugins-bad
sudo apt install -y network-manager python3 python3-gst-1.0 python3-pip dnsmasq git jq wireless-tools iw python3-dev gstreamer1.0-x ppp python3-venv

## Pymavlink
sudo apt install -y python3-lxml python3-numpy

sudo apt purge -y modemmanager
sudo apt remove -y nodejs nodejs-doc

sudo apt-get install -y gpsbabel zip

## Install nodejs
# Check if nodejs is installed and get version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 22 ]; then
        echo "Node.js version $NODE_VERSION is already >= 22, skipping installation"
        SKIP_NODE_INSTALL=true
    fi
fi

# Check if running in github CI. If so, don't install nodejs here
if [ "$GITHUB_ACTIONS" == "true" ]; then
    SKIP_NODE_INSTALL=true
fi

# Get OS info for version check
source /etc/os-release
if [ "$SKIP_NODE_INSTALL" != "true" ]; then
    # Older Ubuntu versions need older NodeJS
    if [ "$ID" == "ubuntu" ] && [ "$VERSION_CODENAME" == "bionic" ]; then
        curl -fsSL https://deb.nodesource.com/setup_16.x | sudo bash -
        sudo apt-get install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
        sudo apt-get install -y nodejs
    fi
fi

## Zerotier and wireguard
curl -s https://install.zerotier.com | sudo bash
sudo apt install -y wireguard wireguard-tools

## Python virtualenv
../python/setup-venv.sh
