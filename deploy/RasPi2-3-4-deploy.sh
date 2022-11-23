#!/bin/bash

set -e
set -x

git submodule update --init --recursive

## Raspi-Config - camera, serial port, ssh
## Note we need legacy camera support here
#sudo raspi-config nonint do_expand_rootfs
sudo raspi-config nonint do_camera 0
sudo raspi-config nonint do_legacy 0
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
sudo apt install -y libgstreamer1.0-dev libgstrtspserver-1.0-dev gstreamer1.0-plugins-good gstreamer1.0-plugins-base-apps gstreamer1.0-plugins-ugly
sudo apt install -y network-manager python3 python3-dev python3-gst-1.0 python3-pip dnsmasq git ninja-build autoconf libtool

sudo apt purge -y modemmanager
sudo apt remove -y nodejs nodejs-doc

sudo systemctl disable dnsmasq
sudo systemctl enable NetworkManager

curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

## Ensure the ~/.local/bin is on the system path
echo "PATH=\$PATH:~/.local/bin" >> ~/.profile
source ~/.profile

sudo pip3 install meson
pip3 install netifaces --user

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## GStreamer raspi
cd ../modules/gst-rpicamsrc
perl -pe 's/(encoded_buffer_q, 500)/encoded_buffer_q, 5000/' -i ./src/RaspiCapture.c
./autogen.sh --prefix=/usr --libdir=/usr/lib/arm-linux-gnueabihf/
make
sudo make install
cd ../../deploy

## Zerotier and wireguard
curl -s https://install.zerotier.com | sudo bash
sudo apt install wireguard wireguard-tools

## mavlink-router
./build_mavlinkrouter.sh

## and build & run Rpanion
./build.sh

## Pymavlink and gpsbabel to create KMZ.
DISABLE_MAVNATIVE=True python3 -m pip install --upgrade pymavlink --user
sudo apt-get install -y gpsbabel

sudo reboot
