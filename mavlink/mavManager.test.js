var assert = require('assert')
var should = require('should')
const mavManager = require('./mavManager')
var udp = require('dgram')

describe('MAVLink Functions', function () {
  it('#startup()', function () {
    var m = new mavManager('common', 1, '127.0.0.1', 15000)

    assert.notEqual(m.mav, null)
    m.close()
  })

  it('#receivepacket()', function (done) {
    var m = new mavManager("common", 2, '127.0.0.1', 15000)
    var packets = []

    m.eventEmitter.on('gotMessage', (msg) => {
      packets.push(msg)
    })

    m.eventEmitter.on('armed', () => {
      assert.equal(m.statusArmed, 1)
      done()
    })

    assert.equal(m.conStatusStr(), 'Not connected')
    assert.equal(m.conStatusInt(), 0)
    assert.equal(m.statusArmed, 0)

    var hb = new Buffer.from([0xfd, 0x09, 0x00, 0x00, 0x07, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x2d, 0x0d, 0x02, 0x7e, 0xfd])
    m.mav.parseBuffer(hb)

    assert.equal(m.conStatusStr(), 'Connected')
    assert.equal(m.conStatusInt(), 1)
    assert.equal(m.autopilotFromID(), 'APM')
    assert.equal(m.vehicleFromID(), 'Antenna Tracker')
    assert.equal(m.statusArmed, 0)
    assert.equal(packets.length, 1)

    // check arming
    var hb = new Buffer.from([0xfd, 0x09, 0x00, 0x01, 0x07, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x8d, 0x0d, 0x02, 0x4c, 0x4f])
    m.mav.parseBuffer(hb)

    assert.equal(m.statusArmed, 1)
  })

  it('#datastreamSend()', function (done) {
    var m = new mavManager('common', 2, '127.0.0.1', 16000)
    var udpStream = udp.createSocket('udp4')

    m.eventEmitter.on('linkready', (info) => {
      m.sendDSRequest()
    })
  })

  it('#rebootSend()', function (done) {
    var m = new mavManager('common', 2, [])

    m.eventEmitter.on('sendData', (buffer) => {
      buffer.should.eql([253, 29, 0, 0, 0, 255, 0, 76, 0, 0, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 246, 51, 134])
      done()
    })

    udpStream.send(Buffer.from([0xfd, 0x06]), 16000, '127.0.0.1', (error) => {
      if (error) {
        console.error(error)
      }
    })
  })


  it('#rebootSend()', function (done) {
    var m = new mavManager('common', 2, '127.0.0.1', 15000)
    var udpStream = udp.createSocket('udp4')

    m.eventEmitter.on('linkready', (info) => {
      m.sendReboot()
    })

    udpStream.on('message', (msg, rinfo) => {
      msg.should.eql(Buffer.from([253, 29, 0, 0, 0, 255, 0, 76, 0, 0, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 246, 51, 134]))
      m.close()
      udpStream.close()
      done()
    })

    udpStream.send(Buffer.from([0xfd, 0x06]), 15000, '127.0.0.1', (error) => {
      if (error) {
        console.error(error)
      }
    })
  })

  it('#perfTest()', function () {
    // how fast can we process packets and send out over udp?
    var m = new mavManager('common', 2, '127.0.0.1', 15000)

    // time how long 255 packets takes
    var starttime = Date.now().valueOf()
    for (var i = 0; i < 255; i++) {
      var hb = new Buffer.from([0xfd, 0x09, 0x00, 0x00, i, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x2d, 0x0d, 0x02, 0x7e, 0xfd])
      m.mav.parseBuffer(hb)
    }
    var delta = Date.now().valueOf() - starttime
    var packetsPerSec = 1000 * (255 / delta)

    console.log('MAVLink performance is ' + parseInt(packetsPerSec) + ' packets/sec')
    m.close()
  })
})
