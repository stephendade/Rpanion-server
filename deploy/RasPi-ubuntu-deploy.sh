#!/bin/bash

set -e
set -x

git submodule update --init --recursive

## Enable serial port
sudo perl -pe 's/console=serial0,115200//' -i /boot/firmware/cmdline.txt 

echo "export PATH=$PATH:$HOME/.local/bin" >> ~/.bashrc

## Camera
# Only works for Ubuntu 20. Can't do this on Ubuntu 22/24 (Ubuntu issue ... not fixable at my end)
if [[ "$(lsb_release -rs)" =~ ^20\. ]]; then
    echo "" | sudo tee -a /boot/firmware/config.txt >/dev/null
    echo "# Enable Camera" | sudo tee -a /boot/firmware/config.txt >/dev/null
    echo "start_x=1" | sudo tee -a /boot/firmware/config.txt >/dev/null
    echo "gpu_mem=128" | sudo tee -a /boot/firmware/config.txt >/dev/null
fi

## Need to temp disable this
sudo systemctl stop unattended-upgrades.service

## Remove this to disable the "Pending Kernel Upgrade" message
# Only required for Ubuntu 22/24
if [[ "$(lsb_release -rs)" =~ ^2[2-9]\. ]]; then
    sudo apt -y remove needrestart
fi

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

if [[ "$(lsb_release -rs)" =~ ^20\. ]]; then
    sudo service network-manager restart
fi
if [[ "$(lsb_release -rs)" =~ ^2[2-9]\. ]]; then
    ## Need this to get eth0 working too
    ## From https://askubuntu.com/questions/1290471/ubuntu-ethernet-became-unmanaged-after-update
    sudo touch /etc/netplan/networkmanager.yaml
    echo "network:" | sudo tee -a /etc/netplan/networkmanager.yaml >/dev/null
    echo "  version: 2" | sudo tee -a /etc/netplan/networkmanager.yaml >/dev/null
    echo "  renderer: NetworkManager" | sudo tee -a /etc/netplan/networkmanager.yaml >/dev/null
    sudo netplan generate
    sudo netplan apply
fi

## and build Rpanion dev
# If less than 520Mb RAM, need to tell NodeJS to reduce memory usage during build
if [ $(free -m | awk '/^Mem:/{print $2}') -le 520 ]; then
    export NODE_OPTIONS="--max-old-space-size=256"
fi
cd ../
npm install

## For wireguard. Must be installed last as it messes the DNS resolutions
sudo apt install -y resolvconf

## And re-enable
sudo systemctl start unattended-upgrades.service

sudo reboot
