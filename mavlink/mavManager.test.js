var assert = require('assert')
var should = require('should')
const mavManager = require('./mavManager')
var udp = require('dgram')

describe('MAVLink Functions', function () {
  it('#startup()', function () {
    var m = new mavManager("common", 1, [])

    assert.notEqual(m.mav, null)
  })

  it('#receivepacket()', function () {
    var m = new mavManager("common", 2, [])
    var packets = []

    m.eventEmitter.on('gotMessage', (msg) => {
      packets.push(msg)
    })

    assert.equal(m.conStatusStr(), 'Not connected')
    assert.equal(m.conStatusInt(), 0)
    assert.equal(m.statusArmed, 0)

    var hb = new Buffer.from([0xfd, 0x09, 0x00, 0x00, 0x07, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x2d, 0x0d, 0x02, 0x7e, 0xfd])
    m.parseBuffer(hb)

    assert.equal(m.conStatusStr(), 'Connected')
    assert.equal(m.conStatusInt(), 1)
    assert.equal(m.autopilotFromID(), 'APM')
    assert.equal(m.vehicleFromID(), 'Antenna Tracker')
    assert.equal(m.statusArmed, 0)
    assert.equal(packets.length, 1)

    // check arming
    var hb = new Buffer.from([0xfd, 0x09, 0x00, 0x01, 0x07, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x8d, 0x0d, 0x02, 0x4c, 0x4f])
    m.parseBuffer(hb)

    assert.equal(m.statusArmed, 1)
  })

  it('#datastreamSend()', function (done) {
    var m = new mavManager("common", 2, [])

    m.eventEmitter.on('sendData', (buffer) => {
      buffer.should.eql([0xfd, 0x06, 0x00, 0x00, 0x00, 0xff, 0x00, 0x42, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x01, 0x2c, 0x7e])
      done()
    })

    m.sendDSRequest()
  })

  it('#rebootSend()', function (done) {
    var m = new mavManager("common", 2, [])

    m.eventEmitter.on('sendData', (buffer) => {
      buffer.should.eql([253, 29, 0, 0, 0, 255, 0, 76, 0, 0, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 246, 51, 134])
      done()
    })

    m.sendReboot()
  })

  it('#udpReceiveSend()', function (done) {
    var m = new mavManager("ardupilot", 2, [{ IP: '127.0.0.1', port: 14580 }])
    var udpStream = udp.createSocket('udp4')
    var hb = new Buffer.from([0xfd, 0x09, 0x00, 0x00, 0x07, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x2d, 0x0d, 0x02, 0x7e, 0xfd])

    m.eventEmitter.on('sendData', (buffer) => {
      m.udpStream.close()
      udpStream.close()
      buffer.should.eql(hb)
      done()
    })

    udpStream.on('message', function (msg, info) {
      udpStream.send(hb, info.port, info.address)

      msg.should.eql(hb)
      // send msg back
    })

    udpStream.bind(14580, '127.0.0.1')

    m.parseBuffer(hb)
  })

  it('#perfTest()', function () {
    // how fast can we process packets and send out over udp?
    var m = new mavManager("common", 2, [{ IP: '127.0.0.1', port: 14580 }])

    // time how long 255 packets takes
    var starttime = Date.now().valueOf()
    for (var i = 0; i < 255; i++) {
      var hb = new Buffer.from([0xfd, 0x09, 0x00, 0x00, i, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x2d, 0x0d, 0x02, 0x7e, 0xfd])
      m.parseBuffer(hb)
    }
    var delta = Date.now().valueOf() - starttime
    var packetsPerSec = 1000 * (255 / delta)
    m.udpStream.close()

    console.log('MAVLink performance is ' + parseInt(packetsPerSec) + ' packets/sec')
  })
})
