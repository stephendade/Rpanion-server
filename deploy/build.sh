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
sudo systemctl enable rpanion.service
