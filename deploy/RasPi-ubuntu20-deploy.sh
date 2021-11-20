#!/bin/bash

set -e
set -x

# need to run from home directory
cd ~/

## Change hostname
sudo hostnamectl set-hostname rpanion --static

## Enable serial port
sudo perl -pe 's/console=serial0,115200//' -i /boot/firmware/cmdline.txt 

echo "export PATH=$PATH:$HOME/.local/bin" >> ~/.bashrc


## Power switch config for Pi-Connect
echo "" | sudo tee -a /boot/firmware/usercfg.txt >/dev/null
echo "# Power switch" | sudo tee -a /boot/firmware/usercfg.txt >/dev/null
echo "dtoverlay=gpio-shutdown" | sudo tee -a /boot/firmware/usercfg.txt >/dev/null
echo "dtoverlay=gpio-poweroff" | sudo tee -a /boot/firmware/usercfg.txt >/dev/null

## Camera
echo "" | sudo tee -a /boot/firmware/config.txt >/dev/null
echo "# Enable Camera" | sudo tee -a /boot/firmware/config.txt >/dev/null
echo "start_x=1" | sudo tee -a /boot/firmware/config.txt >/dev/null
echo "gpu_mem=128" | sudo tee -a /boot/firmware/config.txt >/dev/null

## Need to temp disable this
sudo systemctl stop unattended-upgrades.service

## Packages
sudo apt update
sudo apt upgrade -y
sudo apt install -y gstreamer1.0-plugins-base libgstreamer1.0-dev libgstrtspserver-1.0-dev gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-plugins-base-apps network-manager python3 python3-dev python3-gst-1.0 python3-pip dnsmasq git ninja-build

sudo apt purge -y modemmanager

sudo systemctl disable dnsmasq

curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt install -y nodejs

sudo pip3 install meson
pip3 install netifaces --user

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## Ensure nmcli can manage all network devices
sudo touch /etc/NetworkManager/conf.d/10-globally-managed-devices.conf
echo "[keyfile]" | sudo tee -a /etc/NetworkManager/conf.d/10-globally-managed-devices.conf >/dev/null
echo "unmanaged-devices=*,except:type:wifi,except:type:gsm,except:type:cdma,except:type:wwan,except:type:ethernet,type:vlan" | sudo tee -a /etc/NetworkManager/conf.d/10-globally-managed-devices.conf >/dev/null
sudo service network-manager restart
 
## Rpanion
git clone https://github.com/stephendade/Rpanion-server.git
cd ./Rpanion-server
git submodule update --init --recursive

## mavlink-router
cd ./modules/mavlink-router
meson setup build . --buildtype=release
ninja -C build
sudo ninja -C build install
cd ../../

## and build & run Rpanion
./deploy/build.sh

## Change user and home dir to ubuntu defaults, then reload service
sudo perl -pe 's/pi/ubuntu/' -i /etc/systemd/system/rpanion.service
sudo systemctl daemon-reload
sudo systemctl restart rpanion.service

## And re-enable
sudo systemctl start unattended-upgrades.service

sudo reboot

