#!/bin/bash

set -e
set -x

# need to run from home directory
cd ~/

## Raspi-Config - camera, serial port, ssh
sudo raspi-config nonint do_expand_rootfs
sudo raspi-config nonint do_camera 0
sudo raspi-config nonint do_ssh 0
# Enable serial, disable console
sudo raspi-config nonint do_serial 2

## Change hostname
sudo raspi-config nonint do_hostname rpanion
sudo perl -pe 's/raspberrypi/rpanion/' -i /etc/hosts

## Power switch config for Pi-Connect
echo "" | sudo tee -a /boot/config.txt >/dev/null
echo "# Power switch" | sudo tee -a /boot/config.txt >/dev/null
echo "dtoverlay=gpio-shutdown" | sudo tee -a /boot/config.txt >/dev/null
echo "dtoverlay=gpio-poweroff" | sudo tee -a /boot/config.txt >/dev/null

## Packages
sudo apt update
sudo apt upgrade -y
sudo apt install -y libgstreamer-plugins-base1.0* libgstreamer1.0-dev libgstrtspserver-1.0-dev gstreamer1.0-plugins-bad
sudo apt install -y gstreamer1.0-plugins-ugly gstreamer1.0-plugins-base-apps 
sudo apt install -y python3 python3-dev python3-gst-1.0 python3-pip dnsmasq git

## node.js for the RPi Zero needs the "armv61" build
wget https://nodejs.org/download/release/v11.15.0/node-v11.15.0-linux-armv6l.tar.xz
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJvf node-v11.15.0-linux-armv6l.tar.xz -C /usr/local/lib/nodejs
sudo ln -s /usr/local/lib/nodejs/node-v11.15.0-linux-armv6l/bin/node /usr/local/bin
sudo ln -s /usr/local/lib/nodejs/node-v11.15.0-linux-armv6l/bin/npm /usr/local/bin

## Ensure the ~/.local/bin is on the system path
echo "PATH=\$PATH:~/.local/bin" >> ~/.profile
source ~/.profile

pip3 install netifaces future pymavlink --user

## Rpanion (+ gst-rpicamsrc)
git clone https://github.com/stephendade/Rpanion-server.git
cd ./Rpanion-server
git submodule update --init --recursive

## GStreamer raspi
cd ./modules/gst-rpicamsrc
./autogen.sh --prefix=/usr --libdir=/usr/lib/arm-linux-gnueabihf/
make
sudo make install
cd ../../

## mavlink-router
cd ./modules/mavlink-router
./autogen.sh
./configure CFLAGS='-g -O2'
make
sudo make install
cd ../../

## and build & install Rpanion
set NODE_OPTIONS=--max-old-space-size=256
./deploy/build.sh

## Setup networking (needs to be last, as it disconnects from Wifi)
### Configuring network...
### This will disconnect the Pi Zero from the current network and create a hotspot
### Please wait 5min for the configuration to finish, then reboot the Pi

sudo apt install -y network-manager
sudo apt purge -y openresolv dhcpcd5 modemmanager
sudo apt remove -y modemmanager

sudo systemctl disable dnsmasq

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## Create Wifi AP
./deploy/wifi_access_point.sh

sudo reboot
