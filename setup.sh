#!/bin/bash

# Dependencies
sudo apt install libgstreamer-plugins-base1.0* libgstreamer1.0-dev libgstrtspserver-1.0-dev gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-plugins-base-apps network-manager python3 python3-dev python3-gst-1.0 python3-pip dnsmasq

sudo apt -y purge openresolv dhcpcd5

pip3 install netifaces --user

# Newer version of node.js (12 LTS):
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs npm

#nmcli needs these disabled
sudo systemctl disable dhcpcd

sudo systemctl disable dnsmasq
sudo systemctl disable wpa_supplicant
sudo systemctl mask wpa_supplicant.service

#reboot after this

