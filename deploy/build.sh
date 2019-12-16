#!/bin/bash

set -e
set -x

git pull

npm install
npm run build

## Install Rpanion as service
sudo cp rpanion.service /etc/systemd/system
sudo systemctl enable rpanion.service
