const {exec} = require('child_process');

function getAdapters(callback) {
    //Get all network adapter name, type and states
    exec('nmcli -t -f device,type,state dev', (error, stdout, stderr) => {
    var netStatusList = [];
        if (stderr) {
            console.error(`exec error: ${error}`);
            return callback(stderr);
        }
        else {
            stdout.split("\n").forEach(function (item) {
                    var device = item.split(':');
                    if (device.length == 3 && device[0] != "lo") {
                        console.log("Adding Network device " + device[0]);
                        netStatusList.push({value: device[0], label: device[0] + " (" + device[1] + ")", type: device[1], state: device[2]});
                    }
            });
        }
        return callback(null, netStatusList);
    });
}

function activateConnection(conName, callback) {
    //activate the connection (by id)
    //assumed that conName is a valid UUID
    exec('nmcli connection up ' + conName, (error, stdout, stderr) => {
    if (stderr) {
        console.error(`exec error: ${error}`);
        return callback(stderr);
    }
    else {
        console.log('Activated network: ' + conName);
        return callback(null, "OK");
    }
    });
}

function deactivateConnection(conName, callback) {
    //deactivate the connection (by id)
    //assumed that conName is a valid UUID
    exec('nmcli connection down ' + conName, (error, stdout, stderr) => {
    if (stderr) {
        console.error(`exec error: ${error}`);
        return callback(stderr);
    }
    else {
        console.log('Dectivated network: ' + conName);
        return callback(null, "OK");
    }
    });
}

function addConnection(conNameStr, conType, conAdapter, conSettings, callback) {
    //add a new connection with name conNameStr and settings
    //conSettings
    //nmcli connection add type wifi ifname $IFNAME con-name $APNAME ssid $SSID
    if (conType === "wifi") {
        exec('nmcli connection add type ' + conType + " ifname " + conAdapter +
             " con-name " + conNameStr + " ssid " + conSettings.ssid.value + " 802-11-wireless.mode " +
             conSettings.mode.value + " 802-11-wireless.band " + conSettings.band.value +
             " ipv4.method " + conSettings.ipaddresstype.value + " && " +
             "nmcli -g connection.uuid con show " + conNameStr, (error, stdout, stderr) => {
            if (stderr) {
                console.error(`exec error: ${error}`);
                return callback(stderr);
            }
            else {
                //once the network is created, add in the settings
                var conUUID = stdout.split('\n')[stdout.split('\n').length-2]
                console.log('Added network Wifi: ' + conNameStr + " - " + conAdapter + " - " + conUUID);
                this.editConnection(conUUID, conSettings, (err) => {
                    if (!err) {
                        return callback(null, "AddOK");
                    }
                    else {
                        return callback(err);
                    }
                });
            }
        });
    }
    else {
        exec('nmcli connection add type ' + conType + " ifname " + conAdapter +
             " con-name " + conNameStr + "&&" +
             "nmcli -g connection.uuid con show " + conNameStr, (error, stdout, stderr) => {
        if (stderr) {
            console.error(`exec error: ${error}`);
            return callback(stderr);
        }
        else {
            //once the network is created, add in the settings
            var conUUID = stdout.split('\n')[stdout.split('\n').length-2]
            console.log('Added network Wired: ' + conNameStr + " - " + conAdapter + " - " + conUUID);
            this.editConnection(conUUID, conSettings, (err) => {
                if (!err) {
                    return callback(null, "AddOK");
                }
                else {
                    return callback(err);
                }
            });
        }
        });
    }

}

function editConnection(conName, conSettings, callback) {
    //edit an existing connection
    //assumed that conName is a valid UUID
    //there are 4 types of edits - AttachedInterface, IP, Wifi security, Wifi AP
    //small amount of callback hell here :(
    console.log(conSettings);
    editConnectionAttached(conName, conSettings, (errAttach) => {
        console.log("Attach");
        if (!errAttach) {
            editConnectionIP(conName, conSettings, (errIP) => {
                console.log("IP");
                if (!errIP) {
                    editConnectionPSK(conName, conSettings, (errPSK) => {
                        console.log("PSK");
                        if (!errPSK) {
                            editConnectionAP(conName, conSettings, (errAP) => {
                                console.log("AP");
                                if (!errAP) {
                                    return callback(null, "EditOK");
                                }
                                else {
                                    return callback(errAP);
                                }
                            });
                        }
                        else {
                            return callback(errPSK);
                        }
                    });
                }
                else {
                    return callback(errIP);
                }
            });
        }
        else {
            return callback(errAttach);
        }
    });
}


function editConnectionAttached(conName, conSettings, callback) {
    //edit the attached interface for a connection
    if (conSettings.attachedIface.value === "&quot;&quot;") {
        conSettings.attachedIface.value = "\"\"";
    }

    exec('nmcli connection mod ' + conName + " connection.interface-name " + conSettings.attachedIface.value, (error, stdout, stderr) => {
        if (stderr) {
            console.error(`exec error: ${error}`);
            return callback(stderr);
        }
        else {
            console.log('Edited network Attachment: ' + conName + " to " + conSettings.attachedIface.value);
            return callback(null, "EditAttachOK");
        }
    });
}

function editConnectionIP(conName, conSettings, callback) {
    //first sort out the IP Addressing (DHCP/static) for LAN and Wifi Client
    if (Object.keys(conSettings.ssid).length === 0 || conSettings.mode.value === "infrastructure") {
        if (conSettings.ipaddresstype.value === "auto") {
            exec('nmcli connection mod ' + conName + ' ipv4.method auto ' + 'ipv4.addresses \'\'', (error, stdout, stderr) => {
                if (stderr) {
                    console.error(`exec error: ${error}`);
                    return callback(stderr);
                }
                else {
                    console.log('Edited network IP Auto: ' + conName);
                    return callback(null, "EditOK");
                }
            });
        }
        else if (Object.keys(conSettings.ipaddress).length !== 0 && Object.keys(conSettings.subnet).length !== 0) {
            exec('nmcli connection mod ' + conName + ' ipv4.addresses ' + conSettings.ipaddress.value + "/" +
                 netmask2CIDR(conSettings.subnet.value) + ' ipv4.method ' + conSettings.ipaddresstype.value, (error, stdout, stderr) => {
                if (stderr) {
                    console.error(`exec error: ${error}`);
                    return callback(stderr);
                }
                else {
                    console.log('Edited network IP manual: ' + conName);
                    return callback(null, "EditOK");
                }
            });
        }
    }
    else {
        return callback(null, "EditNotRequired");
    }
}

function editConnectionPSK(conName, conSettings, callback) {
    //now sort out Wifi client/ap settings - password and security type
    if (conSettings.mode.value === "infrastructure" || conSettings.mode.value === "ap") {
        //psk network
        if (conSettings.wpaType.value !== 'wpa-none' &&
            Object.keys(conSettings.ssid).length !== 0 &&
            Object.keys(conSettings.password).length !== 0) {
            exec('nmcli connection mod ' + conName + ' 802-11-wireless-security.key-mgmt ' + conSettings.wpaType.value + ' &&' +
            'nmcli -s connection mod ' + conName + ' 802-11-wireless-security.psk ' + conSettings.password.value, (error, stdout, stderr) => {
            if (stderr) {
                console.error(`exec error: ${error}`);
                return callback(stderr);
            }
            else {
                console.log('Edited Wifi psk: ' + conName);
                return callback(null, "OK");
            }
            });
        }
        //no psk. Note the dirty hack to remove psk
        else if (conSettings.wpaType.value === 'wpa-none' &&
                 Object.keys(conSettings.ssid).length !== 0) {
            exec('nmcli connection mod ' + conName + ' 802-11-wireless-security.key-mgmt ' + conSettings.wpaType.value + ' &&' +
            'nmcli -s connection mod ' + conName + ' 802-11-wireless-security.psk 00000000', (error, stdout, stderr) => {
            if (stderr) {
                console.error(`exec error: ${error}`);
                return callback(stderr);
            }
            else {
                console.log('Edited Wifi no-psk: ' + conName);
                return callback(null, "OK");
            }
            });
        }
    }
    else {
        return callback(null, "EditNotRequired");
    }
}

function editConnectionAP(conName, conSettings, callback) {
    //now sort out Wifi ap settings - ssid, band, starting ip
    if (conSettings.mode.value === "ap") {
        if (Object.keys(conSettings.ssid).length !== 0 &&
            Object.keys(conSettings.band).length !== 0 &&
            Object.keys(conSettings.ipaddress).length !== 0) {
            exec('nmcli connection mod ' + conName + ' 802-11-wireless.ssid ' + conSettings.ssid.value +
            ' 802-11-wireless.band ' + conSettings.band.value + ' ipv4.addresses ' + conSettings.ipaddress.value + "/24" +
            ' 802-11-wireless-security.group ccmp ' + '802-11-wireless-security.pairwise ccmp ' +
            ' 802-11-wireless-security.wps-method 1 ' , (error, stdout, stderr) => {
            if (stderr) {
                console.error(`exec error: ${error}`);
                return callback(stderr);
            }
            else {
                console.log('Edited Wifi ap ssid/band: ' + conName);
                return callback(null, "OK");
            }
            });
        }
    }
    else {
        return callback(null, "EditNotRequired");
    }
}

function deleteConnection(conName, callback) {
    //delete the connection (by id)
    //assumed that conName is a valid UUID
    exec('nmcli connection delete ' + conName, (error, stdout, stderr) => {
    if (stderr) {
        console.error(`exec error: ${error}`);
        return callback(stderr);
    }
    else {
        console.log('Deleted network: ' + conName);
        return callback(null, "OK");
    }
    });
}

function getConnections(callback) {
    //get all connections
    exec('nmcli -t -f NAME,UUID,TYPE,DEVICE connection show', (error, stdout, stderr) => {
    var conStatusList = [];
    if (stderr) {
        console.error(`exec error: ${error}`);
        return callback(stderr);
    }
    else {
        var allConns = stdout.split("\n");
        //stdout.split("\n").forEach(function (item) {
        for (var i = 0, len = allConns.length; i < len; i++) {
                var item = allConns[i];
                var connection = item.split(':');
                var curConn = {};
                if (connection[3] == "" || connection[3] == "--") {
                    curConn = {value: connection[1], label: "", labelPre: connection[0], type: connection[2], state: "", attachedIface: getConnectionIfaceSync(connection[1])};
                    conStatusList.push(curConn);
                }
                //active connection
                else if (connection.length == 4) {
                    curConn = {value: connection[1], label: "", labelPre: connection[0], type: connection[2], state: connection[3], attachedIface: getConnectionIfaceSync(connection[1])};
                    conStatusList.push(curConn);
                }

            }
    }
    return callback(null, conStatusList);
    });

}

function getConnectionIfaceSync(conName){
        //synchonous get if connection mapped to specific interface
        var ret;
        exec('nmcli -s -t -f connection.interface-name connection show ' + conName, (error, stdout, stderr) => {
            if (stderr) {
                //no connection with that name
                console.error(`exec error: ${error}`);
                ret = "";
            }
            else if (stdout.split(":")[0] === "connection.interface-name") {
                ret = stdout.split(":")[1].trim();
            }
            else {
                ret = "";
            }
        });
        while(ret === undefined) {
            require('deasync').sleep(100);
        }
        return ret;
    }

function getConnectionDetails(conName, callback) {
    exec('nmcli -s -t -f ipv4.addresses,802-11-wireless.band,ipv4.method,IP4.ADDRESS,802-11-wireless.ssid,802-11-wireless.mode,802-11-wireless-security.key-mgmt,802-11-wireless-security.psk,connection.interface-name connection show ' + conName, (error, stdout, stderr) => {
        if (stderr) {
            //no connection with that name
            console.error(`exec error: ${error}`);
            return callback(stderr);
        }
        else {
            var ret = {DHCP: "auto", IP: "", subnet: "", mode: "", wpaType: "", password: ""};
            stdout.split("\n").forEach(function (item) {
                if (item.split(":")[0] === "802-11-wireless.ssid") {
                    ret.ssid = item.split(":")[1];
                }
                else if (item.split(":")[0] === "802-11-wireless.band") {
                    ret.band = item.split(":")[1];
                }
                else if (item.split(":")[0] === "ipv4.method") {
                    ret.DHCP = item.split(":")[1];
                }
                //DHCP IP, if using DHCP
                else if (item.split(":")[0] === "IP4.ADDRESS[1]" && item.split(":").length > 1 && item.split(":")[1] !== '') {
                    ret.IP = item.split(":")[1].split("/")[0];
                    ret.subnet = CIDR2netmask(item.split(":")[1].split("/")[1]);
                }
                //static IP
                else if (item.split(":")[0] === "ipv4.addresses" && item.split(":").length > 1 && item.split(":")[1] !== '') {
                    ret.IP = item.split(":")[1].split("/")[0];
                    ret.subnet = CIDR2netmask(item.split(":")[1].split("/")[1]);
                }
                else if (item.split(":")[0] === "802-11-wireless.mode") {
                    ret.mode = item.split(":")[1];
                }
                else if (item.split(":")[0] === "802-11-wireless-security.key-mgmt") {
                    ret.wpaType = item.split(":")[1];
                }
                else if (item.split(":")[0] === "802-11-wireless-security.psk") {
                    ret.password = item.split(":")[1];
                }
                else if (item.split(":")[0] === "connection.interface-name") {
                    ret.attachedIface = item.split(":")[1];
                }
            });
            return callback(null, ret);
        }
    });
}

function CIDR2netmask(bitCountstr) {
    var mask=[];
    var bitCount = parseInt(bitCountstr);
    //console.log(bitCountstr);
    for(var i=0;i<4;i++) {
        var n = Math.min(bitCount, 8);
        //console.log(bitCount);
        mask.push(256 - Math.pow(2, 8-n));
        bitCount -= n;
    }
    return mask.join('.');
}

function netmask2CIDR(mask){
    var cidr = ''
    for (var m of mask.split('.')) {
        if (parseInt(m)>255) {throw 'ERROR: Invalid Netmask'} // Check each group is 0-255
        if (parseInt(m)>0 && parseInt(m)<128) {throw 'ERROR: Invalid Netmask'}

        cidr+=(m >>> 0).toString(2)
    }
    // Condition to check for validity of the netmask
    if (cidr.substring(cidr.search('0'),32).search('1') !== -1) {
        throw 'ERROR: Invalid Netmask ' + mask
    }
    return cidr.split('1').length-1
}

module.exports = {getAdapters,
                  getConnections,
                  getConnectionDetails,
                  activateConnection,
                  deleteConnection,
                  editConnection,
                  addConnection,
                  deactivateConnection};
