#!/bin/bash

set -e
set -x

git submodule update --init --recursive

## Enable serial port
sudo perl -pe 's/console=serial0,115200//' -i /boot/firmware/cmdline.txt 

echo "export PATH=$PATH:$HOME/.local/bin" >> ~/.bashrc

## Camera
echo "" | sudo tee -a /boot/firmware/config.txt >/dev/null
echo "# Enable Camera" | sudo tee -a /boot/firmware/config.txt >/dev/null
echo "start_x=1" | sudo tee -a /boot/firmware/config.txt >/dev/null
echo "gpu_mem=128" | sudo tee -a /boot/firmware/config.txt >/dev/null

## Need to temp disable this
sudo systemctl stop unattended-upgrades.service

## Remove this to disable the "Pending Kernel Upgrade" message
# sudo apt -y remove needrestart

## Packages
./install_common_libraries.sh
sudo apt install -y wireless-tools

sudo systemctl disable dnsmasq

sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update
sudo apt install -y nodejs

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## Ensure nmcli can manage all network devices
sudo touch /etc/NetworkManager/conf.d/10-globally-managed-devices.conf
echo "[keyfile]" | sudo tee -a /etc/NetworkManager/conf.d/10-globally-managed-devices.conf >/dev/null
echo "unmanaged-devices=*,except:type:wifi,except:type:gsm,except:type:cdma,except:type:wwan,except:type:ethernet,type:vlan" | sudo tee -a /etc/NetworkManager/conf.d/10-globally-managed-devices.conf >/dev/null
sudo service network-manager restart

## mavlink-router
./build_mavlinkrouter.sh

## and build & run Rpanion
./build_rpanion.sh

## Need to run service as sudo
sudo perl -pe 's/User=$ENV{SUDO_USER}/User=root/' -i /etc/systemd/system/rpanion.service
sudo systemctl daemon-reload
sudo systemctl restart rpanion.service

## For wireguard. Must be installed last as it messes the DNS resolutions
sudo apt install -y resolvconf

## And re-enable
sudo systemctl start unattended-upgrades.service

sudo reboot
