#!/bin/bash

set -e
set -x

cd ../

# If less than 500Mb RAM, need to tell NodeJS to reduce memory usage during build
if [ $(free -m | awk '/^Mem:/{print $2}') -le 500 ]; then
    set NODE_OPTIONS=--max-old-space-size=256
fi
    
# Run npm install with 3 re-tries, because I have dns issues sometimes
# Define the maximum number of retries
MAX_RETRIES=3

# Define the exit code for npm install
NPM_INSTALL_EXIT_CODE=0

# Loop through the retries
for i in $(seq 1 $MAX_RETRIES); do
  echo "Running npm install (attempt $i)..."
  sudo apt install -y npm
  npm install
  NPM_INSTALL_EXIT_CODE=$?

  # If npm install was successful, break out of the loop
  if [ $NPM_INSTALL_EXIT_CODE -eq 0 ]; then
    echo "npm install succeeded on attempt $i"
    break
  fi

  # If we've reached the maximum number of retries, exit with the last exit code
  if [ $i -eq $MAX_RETRIES ]; then
    echo "npm install failed after $MAX_RETRIES attempts"
    exit $NPM_INSTALL_EXIT_CODE
  fi

  # Otherwise, wait for a bit before trying again
  echo "npm install failed on attempt $i. Retrying in 5 seconds..."
  sleep 5
done

npm run build

## Install Rpanion as service
sudo cp rpanion.service /etc/systemd/system

## Change user and home dir to defaults, then reload service
sudo perl -pe 's/pi/$ENV{SUDO_USER}/' -i /etc/systemd/system/rpanion.service
sudo systemctl daemon-reload
sudo systemctl enable rpanion.service
