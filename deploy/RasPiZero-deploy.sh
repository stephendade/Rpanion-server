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

## Power switch config for Pi-Connect
echo "" | sudo tee -a /boot/config.txt >/dev/null
echo "# Power switch" | sudo tee -a /boot/config.txt >/dev/null
echo "dtoverlay=gpio-shutdown" | sudo tee -a /boot/config.txt >/dev/null
echo "dtoverlay=gpio-poweroff" | sudo tee -a /boot/config.txt >/dev/null

## Packages
sudo apt update
sudo apt upgrade -y
sudo apt install -y gstreamer1.0-plugins-good gstreamer1.0-plugins-ugly
sudo apt install -y gstreamer1.0-plugins-base-apps libgstrtspserver-1.0-dev
sudo apt install -y python3 python3-dev python3-gst-1.0 python3-pip dnsmasq git ninja-build

## node.js for the RPi Zero needs the "armv61" build
wget https://unofficial-builds.nodejs.org/download/release/v14.21.2/node-v14.21.2-linux-armv6l.tar.xz
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJvf node-v14.21.2-linux-armv6l.tar.xz -C /usr/local/lib/nodejs
sudo ln -s /usr/local/lib/nodejs/node-v14.21.2-linux-armv6l/bin/node /usr/local/bin
sudo ln -s /usr/local/lib/nodejs/node-v14.21.2-linux-armv6l/bin/npm /usr/local/bin

## Ensure the ~/.local/bin is on the system path
echo "PATH=\$PATH:~/.local/bin" >> ~/.profile
source ~/.profile

sudo pip3 install meson
pip3 install netifaces picamera2 --user

## Zerotier and wireguard
curl -s https://install.zerotier.com | sudo bash
sudo apt install -y wireguard wireguard-tools resolvconf

## mavlink-router
./build_mavlinkrouter.sh

## and build & run Rpanion
./build.sh

## Pymavlink and gpsbabel to create KMZ.
DISABLE_MAVNATIVE=True python3 -m pip install --upgrade pymavlink --user
sudo apt-get install -y gpsbabel zip

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

## Create Wifi AP
./wifi_access_point.sh

sudo reboot
