#!/bin/bash

set -e
set -x

git submodule update --init --recursive

## Set permissions
sudo adduser $USER dialout
sudo adduser $USER tty
sudo systemctl disable nvgetty.service

## Packages
./install_common_libraries.sh

sudo systemctl disable dnsmasq

#Ubuntu 18 (Jetson) doesn't like modern nodejs
if [ "$ID" == "ubuntu" ] && [ "$VERSION_CODENAME" == "bionic" ]; then
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo bash -
    sudo apt-get install -y nodejs
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
    sudo apt-get install -y nodejs
fi


sudo apt update
sudo apt install -y nodejs

## Configure nmcli to not need sudo
sudo sed -i.bak -e '/^\[main\]/aauth-polkit=false' /etc/NetworkManager/NetworkManager.conf

## Ensure nmcli can manage all network devices
sudo touch /etc/NetworkManager/conf.d/10-globally-managed-devices.conf
echo "[keyfile]" | sudo tee -a /etc/NetworkManager/conf.d/10-globally-managed-devices.conf >/dev/null
echo "unmanaged-devices=*,except:type:wifi,except:type:gsm,except:type:cdma,except:type:wwan,except:type:ethernet,type:vlan" | sudo tee -a /etc/NetworkManager/conf.d/10-globally-managed-devices.conf >/dev/null
if systemctl list-units --full -all | grep -Fq 'network-manager.service'; then
    sudo service network-manager restart
fi
if systemctl list-units --full -all | grep -Fq 'NetworkManager.service'; then
    sudo service NetworkManager restart
fi

## For wireguard. Must be installed last as it messes the DNS resolutions
sudo apt install -y resolvconf

sudo reboot

