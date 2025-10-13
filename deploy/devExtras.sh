#!/bin/bash

# Extra setup for dev systems, not needed for production

## Ensure the ~/.local/bin is on the system path
echo "PATH=\$PATH:~/.local/bin" >> ~/.profile
source ~/.profile

## Pymavlink and gpsbabel to create KMZ. Requires pip version 23 or greater to use --break-system-packages
PIP_VERSION=$(pip3 -V | cut -d' ' -f2 | cut -d'.' -f1)
if [ "$PIP_VERSION" -ge "23" ]; then
    DISABLE_MAVNATIVE=True pip3 install --upgrade pymavlink --user --break-system-packages
else
    DISABLE_MAVNATIVE=True pip3 install --upgrade pymavlink --user
fi


## and build Rpanion dev
# If less than 520Mb RAM, need to tell NodeJS to reduce memory usage during build
if [ $(free -m | awk '/^Mem:/{print $2}') -le 520 ]; then
    export NODE_OPTIONS="--max-old-space-size=256"
fi
cd ../
npm install
