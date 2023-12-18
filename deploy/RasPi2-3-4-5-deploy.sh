#!/bin/bash

set -e
set -x

git submodule update --init --recursive

## Raspi-Config - camera, serial port, ssh
#sudo raspi-config nonint do_expand_rootfs
sudo raspi-config nonint do_camera 0
sudo raspi-config nonint do_ssh 0

## Pi5 uses a different UART for the 40-pin header (/dev/ttyAMA0)
# See https://forums.raspberrypi.com/viewtopic.php?t=359132
if [ -e "/proc/device-tree/compatible" ]; then
    if grep -q "5-model-bbrcm" "/proc/device-tree/compatible"; then
        echo "dtparam=uart0=on" | sudo tee -a /boot/config.txt >/dev/null
    else
        # Enable serial, disable console
        sudo raspi-config nonint do_serial 2
    fi
fi

## Change hostname
sudo raspi-config nonint do_hostname rpanion
sudo perl -pe 's/raspberrypi/rpanion/' -i /etc/hosts

./install_common_libraries.sh

## Only install picamera2 on RaspiOS
sudo apt -y install python3-picamera2 python3-libcamera python3-kms++

sudo systemctl disable dnsmasq
sudo systemctl enable NetworkManager

sudo apt install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update
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
