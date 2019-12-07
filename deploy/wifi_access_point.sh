#!/bin/bash

set -e
set -x

# this script sets up the wifi access point

# Create Access Point
APNAME="WiFiAP"
SSID="rpanion"
KEY="rpanion123"

IFNAME=wlan0
sudo nmcli connection add type wifi ifname $IFNAME con-name $APNAME ssid $SSID
sudo nmcli connection modify $APNAME 802-11-wireless.mode ap
sudo nmcli connection modify $APNAME 802-11-wireless.band bg
sudo nmcli connection modify $APNAME ipv4.method shared
sudo nmcli connection modify $APNAME ipv4.addresses 10.0.2.100/24
# Set security
sudo nmcli connection modify $APNAME 802-11-wireless-security.key-mgmt wpa-psk
sudo nmcli connection modify $APNAME 802-11-wireless-security.psk "$KEY"
sudo nmcli connection modify $APNAME 802-11-wireless-security.group ccmp
sudo nmcli connection modify $APNAME 802-11-wireless-security.pairwise ccmp
# Disable WPS
sudo nmcli connection modify $APNAME 802-11-wireless-security.wps-method 1

sudo nmcli connection up $APNAME

