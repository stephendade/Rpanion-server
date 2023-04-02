#!/bin/bash

# Needs to run from Rpanion root dir

set -e
set -x

## Reset any git changes
git reset --hard
git submodule foreach --recursive git clean -xfd
git submodule foreach --recursive git reset --hard
git submodule update --init --recursive

## Update source
git pull
git submodule update --init --recursive
cd ./deploy

## mavlink-router
./build_mavlinkrouter.sh

## and build & run Rpanion
./build_rpanion.sh

## and restart service
echo "---Upgrade Complete---"
sudo systemctl restart rpanion.service
