#!/bin/bash

set -e
set -x

git submodule update --init --recursive

echo "export PATH=$PATH:$HOME/.local/bin" >> ~/.bashrc

## Need to temp disable this
sudo systemctl stop unattended-upgrades.service

## Remove this to disable the "Pending Kernel Upgrade" message
# sudo apt -y remove needrestart

./install_common_libraries.sh
sudo apt install -y wireless-tools

sudo systemctl disable dnsmasq

curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
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
./build.sh

## For wireguard. Must be installed last as it messes the DNS resolutions
sudo apt install -y resolvconf

## And re-enable
sudo systemctl start unattended-upgrades.service
