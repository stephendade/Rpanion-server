const {exec} = require('child_process');

//Class for getting Ras Pi serial port data

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low) + low)
}

function getAnalogReading(callback) {
    var ret = []
    //[{ port: "A0", mv: 2.56, number: 677}, { port: "A1", mv: 2.45, number: 567}]
    for (var i = 0; i < 4; i++) {
        exec('cat /sys/bus/iio/devices/iio\:device0/in_voltage'+i.toString()+'_raw', (error, stdout, stderr) => {
            if (stderr) {
                //console.error(`exec error: ${error}`);
                //return callback(null, []);
            }
            else {
                var reading = parseInt(stdout);
                ret.push({ port: "A"+i.toString(), mv: reading*(3300/1023), number: reading});
            }
        });
    }
    return callback(null, ret);
}

module.exports = {getAnalogReading}
