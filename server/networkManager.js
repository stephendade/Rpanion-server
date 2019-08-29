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

function getConnections(callback) {
    //get all connections
    exec('nmcli -t -f NAME,UUID,TYPE,DEVICE connection show', (error, stdout, stderr) => {
    var conStatusList = [];
    if (stderr) {
        console.error(`exec error: ${error}`);
        return callback(stderr);
    }
    else {
        stdout.split("\n").forEach(function (item) {
                var connection = item.split(':');
                if (connection[3] == "") {
                    conStatusList.push({value: connection[1], label: connection[0], type: connection[2], state: ""});
                }
                else if (connection.length == 4) {
                    conStatusList.push({value: connection[1], label: connection[0] + " (active)", type: connection[2], state: connection[3]});
                }
            });
    }
    return callback(null, conStatusList);
    });

}

function getConnectionDetails(conName, callback) {
    exec('nmcli -s -t -f ipv4.addresses,802-11-wireless.band,ipv4.method,IP4.ADDRESS,802-11-wireless.ssid,802-11-wireless.mode,802-11-wireless-security.key-mgmt,802-11-wireless-security.psk connection show ' + conName, (error, stdout, stderr) => {
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
                if (item.split(":")[0] === "802-11-wireless.band") {
                    ret.band = item.split(":")[1];
                }
                if (item.split(":")[0] === "ipv4.method") {
                    ret.DHCP = item.split(":")[1];
                }
                else if (item.split(":")[0] === "IP4.ADDRESS[1]" && item.split(":").length > 1) {
                    ret.IP = item.split(":")[1].split("/")[0];
                    ret.subnet = CIDR2netmask(item.split(":")[1].split("/")[1]);
                }
                else if (item.split(":")[0] === "ipv4.addresses" && item.split(":").length > 1) {
                    ret.IP_AP = item.split(":")[1].split("/")[0];
                    ret.subnet_AP = CIDR2netmask(item.split(":")[1].split("/")[1]);
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

module.exports = {getAdapters, getConnections, getConnectionDetails};
