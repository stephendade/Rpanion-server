#!/bin/bash

set -e
set -x

## General Packages
sudo apt update
sudo apt upgrade -y
sudo apt install -y gstreamer1.0-plugins-good libgstrtspserver-1.0-0 gir1.2-gst-rtsp-server-1.0 gstreamer1.0-plugins-base-apps gstreamer1.0-plugins-ugly gstreamer1.0-plugins-bad
sudo apt install -y network-manager python3 python3-gst-1.0 python3-pip dnsmasq git jq

## Pymavlink
sudo apt install -y python3-lxml python3-numpy python3-future

sudo apt purge -y modemmanager
sudo apt remove -y nodejs nodejs-doc

## Ensure the ~/.local/bin is on the system path
echo "PATH=\$PATH:~/.local/bin" >> ~/.profile
source ~/.profile

## Pymavlink and gpsbabel to create KMZ. Requires pip version 23 or greater to use --break-system-packages
PIP_VERSION=$(pip3 -V | cut -d' ' -f2 | cut -d'.' -f1)
if [ "$PIP_VERSION" -ge "23" ]; then
    DISABLE_MAVNATIVE=True pip3 install --upgrade pymavlink --user --break-system-packages
else
    DISABLE_MAVNATIVE=True pip3 install --upgrade pymavlink --user
fi
sudo apt-get install -y gpsbabel zip

## Zerotier and wireguard
curl -s https://install.zerotier.com | sudo bash
sudo apt install -y wireguard wireguard-tools
