#!/bin/bash

set -e
set -x

git submodule update --init --recursive

## Set permissions
sudo adduser $USER dialout
sudo systemctl disable nvgetty.service

## Packages
./install_common_libraries.sh

sudo systemctl disable dnsmasq

curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
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

## For wireguard. Must be installed last as it messes the DNS resolutions
sudo apt install -y resolvconf

sudo reboot

