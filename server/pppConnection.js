/*
    * PPPConnection.js
    * This module manages a PPP connection using pppd.
    * It allows setting device, baud rate, local and remote IPs,
    * starting and stopping the PPP connection, and retrieving data transfer stats.
    * Used for the PPP feature in ArduPilot
*/
const { spawn, execSync } = require('child_process');
const { detectSerialDevices, getSerialPathFromValue } = require('./serialDetection.js')

class PPPConnection {
    constructor(settings) {
        this.settings = settings
        this.isConnected = this.settings.value('ppp.enabled', false);
        this.pppProcess = null;
        this.device = this.settings.value('ppp.uart', null);
        this.baudRate = this.settings.value('ppp.baud', 921600)
        this.localIP = this.settings.value('ppp.localIP', '192.168.144.14');  // default local IP
        this.remoteIP = this.settings.value('ppp.remoteIP', '192.168.144.15'); // default remote IP
        this.baudRates = [
            { value: 115200, label: '115200' },
            { value: 230400, label: '230400' },
            { value: 460800, label: '460800' },
            { value: 921600, label: '921600' },
            { value: 1500000, label: '1.5 MBaud' },
            { value: 2000000, label: '2 MBaud' },
            { value: 12500000, label: '12.5 MBaud' }];
        this.serialDevices = [];
        this.badbaudRate = false; // flag to indicate if the baud rate is not supported
        this.prevdata = null; // previous data for comparison

        if (this.isConnected) {
            const attemptPPPStart = () => {
                this.startPPP(this.device, this.baudRate, this.localIP, this.remoteIP, (err, result) => {
                    if (err) {
                        if (err.message.includes('already connected')) {
                            console.log('PPP connection is already established. Retrying in 1 second...');
                            this.isConnected = false;
                            this.setSettings();
                            setTimeout(attemptPPPStart, 1000); // Retry after 1 second
                        } else {
                            console.error('Error starting PPP connection:', err);
                            this.isConnected = false;
                            this.setSettings();
                        }
                    } else {
                        console.log('PPP connection started successfully');
                    }
                });
            };

            attemptPPPStart();
        }
    }

    setSettings() {
        this.settings.setValue('ppp.uart', this.device);
        this.settings.setValue('ppp.baud', this.baudRate);
        this.settings.setValue('ppp.localIP', this.localIP);
        this.settings.setValue('ppp.remoteIP', this.remoteIP);
        this.settings.setValue('ppp.enabled', this.isConnected);
    }

    quitting() {
        // stop the PPP connection if rpanion is quitting
        if (this.pppProcess) {
            console.log('Stopping PPP connection on quit...');
            this.pppProcess.kill();
            try {
                execSync('sudo pkill -SIGTERM pppd && sleep 1');
            } catch (error) {
                console.error('Error stopping PPP connection on shutdown:', error);
            }
        }
        console.log('PPPConnection quitting');
    }

    async getDevices (callback) {
        // get all serial devices using hardwareDetection module
        try {
            this.serialDevices = await detectSerialDevices()
            return callback(null, this.serialDevices);
        } catch (error) {
            console.error('Error detecting serial devices:', error)
            return callback(error, []);
        }
    }

    startPPP(device, baudRate, localIP, remoteIP, callback) {
        this.badbaudRate = false;
        if (this.isConnected) {
            return callback(new Error('PPP is already connected'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }
        if (!device) {
            return callback(new Error('Device is required'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }
        if (this.pppProcess) {
            return callback(new Error('PPP still running. Please wait for it to finish.'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }

        //ensure device string is valid in the serialdevices list
        const devicePath = getSerialPathFromValue(device, this.serialDevices);
        if (!devicePath) {
            return callback(new Error('Invalid device selected'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }

        this.device = device;
        this.baudRate = baudRate;
        this.localIP = localIP;
        this.remoteIP = remoteIP;
        
        const args = [
            "pppd",
            devicePath,
            this.baudRate, // baud rate
            //'persist',          // enables faster termination
            //'holdoff', '1',     // minimum delay of 1 second between connection attempts
            this.localIP + ':' + this.remoteIP, // local and remote IPs
            'local',
            'noauth',
            //'debug',
            'crtscts',
            'nodetach',
            'ktune'
        ];
        // if running in dev env, need to preload sudo login
        if (process.env.NODE_ENV === 'development') {
            execSync('sudo -v');
        }
        console.log(`Starting PPP with args: ${args.join(' ')}`);
        this.pppProcess = spawn('sudo', args, {
        //detached: true,
        stdio: ['ignore', 'pipe', 'pipe'] // or 'ignore' for all three to fully detach
        });
        this.pppProcess.stdout.on('data', (data) => {
            console.log("PPP Output: ", data.toString().trim());
            // Check for non support baud rates "speed <baud> not supported"
            if (data.toString().includes('speed') && data.toString().includes('not supported')) {
                this.pppProcess.kill();
                this.pppProcess = null; // reset the process reference
                this.isConnected = false;
                this.badbaudRate = true;
            }
        });
        this.pppProcess.stderr.on('data', (data) => {
            console.log("PPP Error: ", data.toString().trim());
        });
        this.pppProcess.on('close', (code) => {
            console.log("PPP process exited with code: ", code.toString().trim());
            this.isConnected = false;
            this.pppProcess = null; // reset the process reference
            this.setSettings();
        });
        this.isConnected = true;
        this.setSettings();
        return callback(null, {
            selDevice: this.device,
            selBaudRate: this.baudRate,
            localIP: this.localIP,
            remoteIP: this.remoteIP,
            enabled: this.isConnected,
            baudRates: this.baudRates,
            serialDevices: this.serialDevices,
        });
    }

    stopPPP(callback) {
        if (!this.isConnected) {
            return callback(new Error('PPP is not connected'), {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        }
        if (this.pppProcess) {
            // Gracefully kill the PPP process
            console.log('Stopping PPP connection...');
            this.pppProcess.kill();
            execSync('sudo pkill -SIGTERM pppd');
            this.isConnected = false;
            this.setSettings();
        }
        return callback(null, {
            selDevice: this.device,
            selBaudRate: this.baudRate,
            localIP: this.localIP,
            remoteIP: this.remoteIP,
            enabled: this.isConnected,
            baudRates: this.baudRates,
            serialDevices: this.serialDevices,
        });
    }

    getPPPdatarate(callback) {
        if (!this.isConnected) {
            return callback(new Error('PPP is not connected'));
        }
        // get current data transfer stats for connected PPP session
        return new Promise((resolve, reject) => {
            exec('ifconfig ppp0', (error, stdout, stderr) => {
                if (error) {
                    reject(`Error getting PPP data rate: ${stderr}`);
                } else {
                    // match format RX packets 110580  bytes 132651067 (132.6 MB)
                    const match = stdout.match(/RX packets \d+  bytes (\d+) \(\d+\.\d+ MB\).*TX packets \d+  bytes (\d+) \(\d+\.\d+ MB\)/);
                    if (match) {
                        const rxBytes = parseInt(match[1], 10);
                        const txBytes = parseInt(match[5], 10);
                        resolve({ rxBytes, txBytes });
                    } else {
                        reject('Could not parse PPP data rate');
                    }
                }
            });
        });
    }

    getPPPSettings(callback) {
        this.getDevices((err, devices) => {
            if (err) {
                console.error('Error fetching serial devices:', err);
                return callback(err, {
                    selDevice: null,
                    selBaudRate: this.baudRate,
                    localIP: this.localIP,
                    remoteIP: this.remoteIP,
                    enabled: this.isConnected,
                    baudRates: this.baudRates,
                    serialDevices: [],
                });
            }
            
            this.serialDevices = devices;
            
            // Set default device if not already set
            if (!this.device && this.serialDevices.length > 0) {
                this.device = this.serialDevices[0].value;
            }
            
            // if this.device is not in the list, set it to first available device
            if (this.device && !this.serialDevices.some(d => d.value === this.device)) {
                this.device = this.serialDevices[0].value;
            }
            
            // Always return callback
            return callback(null, {
                selDevice: this.device,
                selBaudRate: this.baudRate,
                localIP: this.localIP,
                remoteIP: this.remoteIP,
                enabled: this.isConnected,
                baudRates: this.baudRates,
                serialDevices: this.serialDevices,
            });
        });
    }

    // uses ifconfig to get the PPP connection datarate
    getPPPDataRate() {
        if (!this.isConnected) {
            return { rxRate: 0, txRate: 0 };
        }
        // get current data transfer stats for connected PPP session
        try {
            let stdout = execSync('ifconfig ppp0 | grep packets', { encoding: 'utf8' }).toString().trim();
            if (!stdout) {
                return { rxRate: 0, txRate: 0, percentusedRx: 0, percentusedTx: 0 };
            }
            // match format :
            //        RX packets 0  bytes 0 (0.0 B)
            //        TX packets 118  bytes 12232 (12.2 KB)
            const [ , matchRX, matchTX ] = stdout.match(/RX\s+packets\s+\d+\s+bytes\s+(\d+).*TX\s+packets\s+\d+\s+bytes\s+(\d+)/s);
            if (matchRX && matchTX) {
                const rxBytes = parseInt(matchRX);
                const txBytes = parseInt(matchTX);
                // calculate the data rate in bytes per second
                if (this.prevdata) {
                    const elapsed = Date.now() - this.prevdata.timestamp; // in milliseconds
                    const rxRate = (rxBytes - this.prevdata.rxBytes) / (elapsed / 1000); // bytes per second
                    const txRate = (txBytes - this.prevdata.txBytes) / (elapsed / 1000); // bytes per second
                    const percentusedRx = rxRate / (this.baudRate / 8); // percent of baud rate used
                    const percentusedTx = txRate / (this.baudRate / 8); // percent of baud rate used
                    this.prevdata = { rxBytes, txBytes, timestamp: Date.now() };
                    return { rxRate, txRate, percentusedRx, percentusedTx };
                }
                this.prevdata = { rxBytes, txBytes, timestamp: Date.now() };
                return { rxRate: 0, txRate: 0, percentusedRx: 0, percentusedTx: 0 };
            } else {
                return { rxRate: 0, txRate: 0, percentusedRx: 0, percentusedTx: 0};
            }
        } catch (error) {
            console.error('Error getting PPP data rate:', error.message);
            return { rxRate: 0, txRate: 0, percentusedRx: 0, percentusedTx: 0 };
        }
    }

    // Returns a string representation of the PPP connection status for use by socket.io
    conStatusStr () {
        //format the connection status string
        if (this.badbaudRate) {
            return 'Disconnected (Baud rate not supported)';
        }
        if (!this.isConnected) {
            return 'Disconnected';
        }
        if (this.pppProcess && this.pppProcess.pid) {
            //get datarate
            const { rxRate, txRate, percentusedRx, percentusedTx } = this.getPPPDataRate();
            let status = 'Connected';
            if (this.pppProcess.pid) {
                status += ` (PID: ${this.pppProcess.pid})`;
            }
            if (rxRate > 0 || txRate > 0) {
                status += `, RX: ${rxRate.toFixed(2)} B/s (${(percentusedRx * 100).toFixed(2)}%), TX: ${txRate.toFixed(2)} B/s (${(percentusedTx * 100).toFixed(2)}%)`;
            } else {
                status += ', No data transfer';
            }
            return status;
        }
        else {
            return 'Disconnected';
        }
    }
}


module.exports = PPPConnection;