const assert = require('assert')
const should = require('should')
const mavManager = require('./mavManager')
const udp = require('dgram')

describe('MAVLink Functions', function () {
  it('#startup()', function () {
    const m = new mavManager(1, '127.0.0.1', 15000)

    assert.notEqual(m.mav, null)
    m.close()
  })

  it('#receivepacket()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 15000)
    const packets = []

    m.eventEmitter.on('gotMessage', (packet, data) => {
      packets.push(packet.buffer)
    })

    m.eventEmitter.on('armed', () => {
      assert.equal(m.statusArmed, 1)
      m.close()
      done()
    })

    assert.equal(m.conStatusStr(), 'Not connected')
    assert.equal(m.conStatusInt(), 0)
    assert.equal(m.statusArmed, 0)

    const hb = new Buffer.from([0xfd, 0x09, 0x00, 0x00, 0x07, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x2d, 0x0d, 0x02, 0x7e, 0xfd])
    m.inStream.write(hb)

    assert.equal(m.conStatusStr(), 'Connected')
    assert.equal(m.conStatusInt(), 1)
    assert.equal(m.autopilotFromID(), 'APM')
    assert.equal(m.vehicleFromID(), 'Antenna Tracker')
    assert.equal(m.statusArmed, 0)
    assert.equal(packets.length, 1)

    // check arming
    const hbb = new Buffer.from([0xfd, 0x09, 0x00, 0x01, 0x07, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x8d, 0x0d, 0x02, 0x4c, 0x4f])
    m.inStream.write(hbb)
  })

  it('#versionSend()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 16000)
    const udpStream = udp.createSocket('udp4')

    assert.equal(m.statusBytesPerSec.avgBytesSec, 0)

    m.eventEmitter.on('linkready', (info) => {
      m.sendVersionRequest()
    })

    udpStream.on('message', (msg, rinfo) => {
      msg.should.eql(Buffer.from([0xfd, 0x21, 0x00, 0x00, 0x00, 0x00, 0xBF, 0x4c, 0x00, 0x00, 0x00, 0x00, 0x14, 0x43, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
        0x00, 0x00, 0x01, 0xbf, 0x5b]))
      assert.equal(m.statusBytesPerSec.bytes, 2)
      m.close()
      udpStream.close()
      done()
    })

    udpStream.send(Buffer.from([0xfd, 0x06]), 16000, '127.0.0.1', (error) => {
      if (error) {
        console.error(error)
      }
    })
  })

  it('#dsSend()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 15000)
    const udpStream = udp.createSocket('udp4')

    m.eventEmitter.on('linkready', (info) => {
      m.sendDSRequest()
    })

    udpStream.on('message', (msg, rinfo) => {
      msg.should.eql(Buffer.from([253, 6, 0, 0, 0, 0, 191, 66, 0, 0, 4, 0, 0, 0, 0, 1, 171, 220]))
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

  it('#rebootSend()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 15000)
    const udpStream = udp.createSocket('udp4')

    m.eventEmitter.on('linkready', (info) => {
      m.sendReboot()
    })

    udpStream.on('message', (msg, rinfo) => {
      msg.should.eql(Buffer.from([253, 33, 0, 0, 0, 0, 191, 76, 0, 0, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 246, 0, 0, 0, 1, 187, 227]))
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
  
  it('#heartbeatSend()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 15000)
    const udpStream = udp.createSocket('udp4')

    m.eventEmitter.on('linkready', (info) => {
      m.sendHeartbeat()
    })

    udpStream.on('message', (msg, rinfo) => {
      msg.should.eql(Buffer.from([253, 9, 0, 0, 0, 0, 191, 0, 0, 0, 0, 0, 0, 0, 18, 8, 0, 0, 2, 61, 244 ]))
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

  it('#commandAckSend()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 15000)
    const udpStream = udp.createSocket('udp4')

    m.eventEmitter.on('linkready', (info) => {
      m.sendCommandAck()
    })

    udpStream.on('message', (msg, rinfo) => {
      msg.should.eql(Buffer.from([253, 9, 0, 0, 0, 0, 191, 77, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 197, 27]))
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
    const m = new mavManager(2, '127.0.0.1', 15000)

    // time how long 255 HB packets takes
    const starttime = Date.now().valueOf()
    for (let i = 0; i < 255; i++) {
      const hb = new Buffer.from([0xfd, 0x09, 0x00, 0x00, i, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x2d, 0x0d, 0x02, 0x7e, 0xfd])
      m.inStream.write(hb)
    }
    const delta = Date.now().valueOf() - starttime
    const packetsPerSec = 1000 * (255 / delta)

    console.log('MAVLink performance is ' + parseInt(packetsPerSec) + ' packets/sec')
    m.close()
  })
})