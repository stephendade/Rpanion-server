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
