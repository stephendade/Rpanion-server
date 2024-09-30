#!/bin/bash

set -e
set -x

## General Packages
sudo apt update
sudo apt upgrade -y
sudo apt install -y libunwind-dev
sudo apt install -y gstreamer1.0-plugins-good libgstrtspserver-1.0-dev gstreamer1.0-plugins-base-apps gstreamer1.0-plugins-ugly gstreamer1.0-plugins-bad
sudo apt install -y network-manager python3 python3-dev python3-gst-1.0 python3-pip dnsmasq git ninja-build

## Pymavlink
sudo apt install -y libxml2-dev libxslt1-dev python3-lxml python3-numpy

sudo apt purge -y modemmanager
sudo apt remove -y nodejs nodejs-doc

## Ensure the ~/.local/bin is on the system path
echo "PATH=\$PATH:~/.local/bin" >> ~/.profile
source ~/.profile

# Debian Bookdown does not like pip install wthout a virtualenv, so do apt installs instead
# Also need gstreamer1.0-libcamera, as the libcamerasrc gst element has moved
source /etc/os-release
if [[ "$ID" == "debian" || "$ID" == "raspbian" ]] && [ "$VERSION_CODENAME" == "bookworm" ]; then
    sudo apt install -y meson python3-netifaces gstreamer1.0-libcamera
else
    sudo python3 -m pip install --upgrade pip
    sudo pip3 install meson
    pip3 install netifaces --user
fi

## Pymavlink and gpsbabel to create KMZ.
#Ubuntu 18 (Jetson) doesn't like the --break-system-packages option
if [ "$ID" == "ubuntu" ] && [ "$VERSION_CODENAME" == "bionic" ]; then
    DISABLE_MAVNATIVE=True pip3 install --upgrade pymavlink --user
else
    DISABLE_MAVNATIVE=True pip3 install --upgrade pymavlink --user --break-system-packages
fi
sudo apt-get install -y gpsbabel zip

## Zerotier and wireguard
curl -s https://install.zerotier.com | sudo bash
sudo apt install -y wireguard wireguard-tools
