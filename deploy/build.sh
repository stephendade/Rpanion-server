#!/bin/bash

set -e
set -x

cd ../

git pull origin master --rebase

# If less than 500Mb RAM, need to tell NodeJS to reduce memory usage during build
if [ $(free -m | awk '/^Mem:/{print $2}') -le 500 ]; then
    set NODE_OPTIONS=--max-old-space-size=256
fi
    
npm install
npm run build

## Install Rpanion as service
sudo cp rpanion.service /etc/systemd/system

## Change user and home dir to defaults, then reload service
sudo perl -pe 's/pi/$ENV{SUDO_USER}/' -i /etc/systemd/system/rpanion.service
sudo systemctl daemon-reload
sudo systemctl enable rpanion.service
