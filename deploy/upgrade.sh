#!/bin/bash

set -e
set -x

## Update source
cd ../
git pull
git submodule update --init --recursive

## mavlink-router
cd ./deploy
./build_mavlinkrouter.sh
cd ../

## and build & run Rpanion
./deploy/build.sh

