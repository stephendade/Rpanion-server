#!/bin/bash

set -e
set -x

git submodule update --init --recursive

# Increase swap size to 1024MB if it is currently less than 1000MB
# Allows the NPM build to complete successfully on systems with 500MB of RAM
if [ $(stat -c%s "/var/swap") -le 1000000000 ]; then
    echo "Swap file is less than 1000MB. Increasing to 1024MB."
    sudo dphys-swapfile swapoff
    sudo sed -i '/CONF_SWAPSIZE=.*/c\CONF_SWAPSIZE=1024' /etc/dphys-swapfile
    sudo dphys-swapfile setup
    sudo dphys-swapfile swapon
else
    echo "Swapfile is already >1000MB"
fi

## Pi5 uses a different UART for the 40-pin header (/dev/ttyAMA0)
# See https://forums.raspberrypi.com/viewtopic.php?t=359132
if [ -e "/proc/device-tree/compatible" ]; then
    if grep -q "5-model-bbrcm" "/proc/device-tree/compatible"; then
        echo "dtparam=uart0=on" | sudo tee -a /boot/firmware/config.txt >/dev/null
    else
        # Enable serial, disable console
        sudo raspi-config nonint do_serial 2
    fi
fi

./install_common_libraries.sh

# Also need gstreamer1.0-libcamera, as the libcamerasrc gst element has moved in bookworm
source /etc/os-release
if [[ "$ID" == "debian" || "$ID" == "raspbian" ]] && [ "$VERSION_CODENAME" == "bookworm" ]; then
    sudo apt install -y  gstreamer1.0-libcamera

## Only install picamera2 on RaspiOS
sudo apt -y install python3-picamera2 python3-libcamera python3-kms++

sudo systemctl disable dnsmasq
sudo systemctl enable NetworkManager

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## For wireguard. Must be installed last as it messes the DNS resolutions
sudo apt install -y resolvconf

sudo reboot
