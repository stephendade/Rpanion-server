#!/bin/bash

set -e
set -x

cd ../modules/mavlink-router
meson setup build . --buildtype=release
ninja -C build
sudo ninja -C build install
cd ../../deploy
