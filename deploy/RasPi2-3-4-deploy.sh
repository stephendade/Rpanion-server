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
sudo apt install -y libgstreamer-plugins-base1.0* libgstreamer1.0-dev libgstrtspserver-1.0-dev gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-plugins-base-apps network-manager python3 python3-dev python3-gst-1.0 python3-pip dnsmasq git

sudo apt purge -y openresolv dhcpcd5 modemmanager
sudo apt remove -y modemmanager

sudo systemctl disable dnsmasq

curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt install -y nodejs

## Ensure the ~/.local/bin is on the system path
echo "PATH=\$PATH:~/.local/bin" >> ~/.profile
source ~/.profile

pip3 install netifaces future pymavlink --user

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## Rpanion (+ gst-rpicamsrc)
git clone https://github.com/stephendade/Rpanion-server.git
cd ./Rpanion-server
git submodule update --init --recursive

## GStreamer raspi
cd ./modules/gst-rpicamsrc
#sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' ./src/RaspiCapture.c
perl -pe 's/(encoded_buffer_q, 500)/encoded_buffer_q, 5000/' -i ./src/RaspiCapture.c
./autogen.sh --prefix=/usr --libdir=/usr/lib/arm-linux-gnueabihf/
make
sudo make install
cd ../../

## mavlink-router
cd ./modules/mavlink-router
./autogen.sh
./configure CFLAGS='-g -O2' --disable-systemd
make
sudo make install
cd ../../

## and build & run Rpanion
./deploy/build.sh

sudo reboot
