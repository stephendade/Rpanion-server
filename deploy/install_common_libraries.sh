#!/bin/bash

set -e
set -x

## General Packages
sudo apt update
sudo apt upgrade -y
sudo apt install -y gstreamer1.0-plugins-good libgstrtspserver-1.0-0 gir1.2-gst-rtsp-server-1.0 gstreamer1.0-plugins-base-apps gstreamer1.0-plugins-ugly gstreamer1.0-plugins-bad
sudo apt install -y network-manager python3 python3-gst-1.0 python3-pip dnsmasq git jq wireless-tools iw

## Pymavlink
sudo apt install -y python3-lxml python3-numpy

sudo apt purge -y modemmanager
sudo apt remove -y nodejs nodejs-doc

sudo apt-get install -y gpsbabel zip

## Zerotier and wireguard
curl -s https://install.zerotier.com | sudo bash
sudo apt install -y wireguard wireguard-tools
