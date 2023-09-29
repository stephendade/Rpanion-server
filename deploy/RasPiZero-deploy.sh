#!/bin/bash

set -e
set -x

git submodule update --init --recursive

## Raspi-Config - camera, serial port
#sudo raspi-config nonint do_expand_rootfs
sudo raspi-config nonint do_camera 0
sudo raspi-config nonint do_ssh 0
# Enable serial, disable console
sudo raspi-config nonint do_serial 2

## Change hostname
sudo raspi-config nonint do_hostname rpanion
sudo perl -pe 's/raspberrypi/rpanion/' -i /etc/hosts

./install_common_libraries.sh

## Only install picamera2 on RaspiOS
pip3 install picamera2 --user

## node.js for the RPi Zero needs the "armv61" build
wget https://unofficial-builds.nodejs.org/download/release/v16.19.1/node-v16.19.1-linux-armv6l.tar.xz
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJvf node-v16.19.1-linux-armv6l.tar.xz -C /usr/local/lib/nodejs
sudo ln -s /usr/local/lib/nodejs/node-v16.19.1-linux-armv6l/bin/node /usr/local/bin
sudo ln -s /usr/local/lib/nodejs/node-v16.19.1-linux-armv6l/bin/npm /usr/local/bin

## mavlink-router
./build_mavlinkrouter.sh

## and build & run Rpanion
./build_rpanion.sh

## Setup networking (needs to be last, as it disconnects from Wifi)
### Configuring network...
### This will disconnect the Pi Zero from the current network and create a hotspot
### Please wait 5min for the configuration to finish, then reboot the Pi

sudo apt install -y network-manager
sudo apt purge -y modemmanager

sudo systemctl disable dnsmasq
sudo systemctl enable NetworkManager

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## NPM has a different directory here, so need the change service detials
sudo perl -pi -w -e 's{/usr/bin/npm}{/usr/local/bin/npm}g;'  /etc/systemd/system/rpanion.service

## For wireguard. Must be installed last as it messes the DNS resolutions
sudo apt install -y resolvconf

## Create Wifi AP
./wifi_access_point.sh

sudo reboot
