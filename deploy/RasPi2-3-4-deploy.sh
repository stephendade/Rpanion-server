#!/bin/bash

set -e
set -x

git submodule update --init --recursive

## Raspi-Config - camera, serial port, ssh
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

./install_common_libraries.sh

sudo systemctl disable dnsmasq
sudo systemctl enable NetworkManager

curl -skL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## mavlink-router
./build_mavlinkrouter.sh

## and build & run Rpanion
./build_rpanion.sh

## For wireguard. Must be installed last as it messes the DNS resolutions
sudo apt install -y resolvconf

sudo reboot
