#!/bin/bash

set -e
set -x

cd ../modules/mavlink-router
meson setup build . --buildtype=release

# If less than 500Mb RAM, run with -j2 to not run out of RAM
if [ $(free -m | awk '/^Mem:/{print $2}') -le 500 ]; then
    ninja -j 2 -C build
else
    ninja -C build
fi

sudo ninja -C build install
cd ../../deploy
