#!/bin/bash

set -e
set -x

## Reset any git changes
git reset --hard
git submodule foreach --recursive git clean -xfd
git submodule foreach --recursive git reset --hard
git submodule update --init --recursive

## Update source
cd ../
git pull
git submodule update --init --recursive
cd ./deploy

## mavlink-router
./build_mavlinkrouter.sh

## and build & run Rpanion
./build.sh
