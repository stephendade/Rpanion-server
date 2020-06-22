#!/bin/bash

## Create a disk image of the Pi's SD card
## This should be run on a host computer with
## the Pi's SD card inserted
set -e
set -x

#TIMESTAMP="$(date -u '+%Y%m%d%H%M%S')"
FILENAME="Rpanion-Server-X.Y.Z-RasPiOS.img"
DEVICE=/dev/mmcblk0
time (sudo dd status=progress if=$DEVICE of=$FILENAME status=progress) # ~1G/minute
sudo ./pishrink.sh -Zpa $FILENAME # from https://github.com/Drewsif/PiShrink
#date; time xz --verbose -e "$FILENAME"  #~47m
#COMPRESSED="$FILENAME.xz"
#ls -l --si "$COMPRESSED" # ~870MB
