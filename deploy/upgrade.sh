#!/bin/bash

set -e
set -x

## Update source
cd ../
git pull
git submodule update --init --recursive
cd ./deploy

## mavlink-router
./build_mavlinkrouter.sh

## and build & run Rpanion
./build.sh
