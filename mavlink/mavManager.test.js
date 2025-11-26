const assert = require('assert')
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

    m.eventEmitter.on('gotMessage', (packet,) => {
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

    m.eventEmitter.on('linkready', () => {
      m.sendVersionRequest()
    })

    udpStream.on('message', (msg) => {
      assert.deepStrictEqual(msg, Buffer.from([0xfd, 0x21, 0x00, 0x00, 0x00, 0x00, 0xBF, 0x4c, 0x00, 0x00, 0x00, 0x00, 0x14, 0x43, 0x00, 0x00, 0x00, 0x00,
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

    m.eventEmitter.on('linkready', () => {
      m.sendDSRequest()
    })

    udpStream.on('message', (msg) => {
      assert.deepStrictEqual(msg, Buffer.from([253, 6, 0, 0, 0, 0, 191, 66, 0, 0, 4, 0, 0, 0, 0, 1, 171, 220]))
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

    m.eventEmitter.on('linkready', () => {
      m.sendReboot()
    })

    udpStream.on('message', (msg) => {
      assert.deepStrictEqual(msg, Buffer.from([253, 33, 0, 0, 0, 0, 191, 76, 0, 0, 0, 0, 128, 63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 246, 0, 0, 0, 1, 187, 227]))
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

    m.eventEmitter.on('linkready', () => {
      m.sendHeartbeat()
    })

    udpStream.on('message', (msg) => {
      assert.deepStrictEqual(msg, Buffer.from([253, 9, 0, 0, 0, 0, 191, 0, 0, 0, 0, 0, 0, 0, 18, 8, 0, 0, 2, 61, 244 ]))
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

    m.eventEmitter.on('linkready', () => {
      m.sendCommandAck()
    })

    udpStream.on('message', (msg) => {
      assert.deepStrictEqual(msg, Buffer.from([253, 9, 0, 0, 0, 0, 191, 77, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 197, 27]))
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

  it('#decodeFlightSwVersion()', function () {
    const m = new mavManager(2, '127.0.0.1', 17000)

    // Test dev version: 4.5.3-dev (0x04050300)
    assert.equal(m.decodeFlightSwVersion(0x04050300), '4.5.3-dev')
    
    // Test alpha version: 4.5.3-alpha (0x04050340)
    assert.equal(m.decodeFlightSwVersion(0x04050340), '4.5.3-alpha')
    
    // Test beta version: 4.5.3-beta (0x04050380)
    assert.equal(m.decodeFlightSwVersion(0x04050380), '4.5.3-beta')
    
    // Test rc version: 4.5.3-rc (0x040503C0)
    assert.equal(m.decodeFlightSwVersion(0x040503C0), '4.5.3-rc')
    
    // Test official version: 4.5.3-official (0x040503FF)
    assert.equal(m.decodeFlightSwVersion(0x040503FF), '4.5.3-official')
    
    // Test unknown version type (0x04050332)
    assert.equal(m.decodeFlightSwVersion(0x04050332), '4.5.3-Unknown')

    m.close()
  })

  it('#autopilotFromID()', function () {
    const m = new mavManager(2, '127.0.0.1', 17100)

    m.statusFWName = 0
    assert.equal(m.autopilotFromID(), 'Generic')
    
    m.statusFWName = 3
    assert.equal(m.autopilotFromID(), 'APM')
    
    m.statusFWName = 4
    assert.equal(m.autopilotFromID(), 'OpenPilot')
    
    m.statusFWName = 12
    assert.equal(m.autopilotFromID(), 'PX4')
    
    m.statusFWName = 99
    assert.equal(m.autopilotFromID(), 'Unknown')

    m.close()
  })

  it('#vehicleFromID()', function () {
    const m = new mavManager(2, '127.0.0.1', 17200)

    m.statusVehType = 0
    assert.equal(m.vehicleFromID(), 'Generic')
    
    m.statusVehType = 1
    assert.equal(m.vehicleFromID(), 'Fixed Wing')
    
    m.statusVehType = 2
    assert.equal(m.vehicleFromID(), 'Quadcopter')
    
    m.statusVehType = 4
    assert.equal(m.vehicleFromID(), 'Helicopter')
    
    m.statusVehType = 5
    assert.equal(m.vehicleFromID(), 'Antenna Tracker')
    
    m.statusVehType = 6
    assert.equal(m.vehicleFromID(), 'GCS')
    
    m.statusVehType = 10
    assert.equal(m.vehicleFromID(), 'Ground Rover')
    
    m.statusVehType = 11
    assert.equal(m.vehicleFromID(), 'Boat')
    
    m.statusVehType = 12
    assert.equal(m.vehicleFromID(), 'Submarine')
    
    m.statusVehType = 13
    assert.equal(m.vehicleFromID(), 'Hexacopter')
    
    m.statusVehType = 14
    assert.equal(m.vehicleFromID(), 'Octocopter')
    
    m.statusVehType = 15
    assert.equal(m.vehicleFromID(), 'Tricopter')
    
    m.statusVehType = 99
    assert.equal(m.vehicleFromID(), 'Unknown')

    m.close()
  })

  it('#conStatusStr()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 17300)

    // Initially not connected
    assert.equal(m.conStatusStr(), 'Not connected')
    assert.equal(m.conStatusInt(), 0)

    // Simulate receiving a packet
    m.eventEmitter.on('linkready', () => {
      const hb = new Buffer.from([0xfd, 0x09, 0x00, 0x00, 0x07, 0x2a, 0x96, 0x00, 0x00, 0x00, 0x44, 0x00, 0x00, 0x00, 0x05, 0x03, 0x2d, 0x0d, 0x02, 0x7e, 0xfd])
      m.inStream.write(hb)

      // Should be connected now
      setTimeout(() => {
        assert.equal(m.conStatusStr(), 'Connected')
        assert.equal(m.conStatusInt(), 1)

        // Simulate connection loss by setting old timestamp
        m.timeofLastPacket = Date.now().valueOf() - 10000
        assert.ok(m.conStatusStr().includes('Connection lost'))
        assert.equal(m.conStatusInt(), -1)

        m.close()
        done()
      }, 100)
    })

    const udpStream = udp.createSocket('udp4')
    udpStream.send(Buffer.from([0xfd, 0x06]), 17300, '127.0.0.1')
  })

  it('#restart()', function () {
    const m = new mavManager(2, '127.0.0.1', 16500)

    // Set some state
    m.RinudpPort = 12345
    m.RinudpIP = '192.168.1.1'
    m.targetSystem = 1
    m.targetComponent = 1

    // Restart the manager
    m.restart()

    // Target should be reset
    assert.equal(m.targetSystem, null)
    assert.equal(m.targetComponent, null)
    assert.equal(m.RinudpPort, null)
    assert.equal(m.RinudpIP, null)
    assert.equal(m.statusBytesPerSec.avgBytesSec, 0)

    m.close()
  })

  it('#isRebooting()', function () {
    const m = new mavManager(2, '127.0.0.1', 16100)
    
    assert.equal(m.isRebooting, false)
    m.sendReboot()
    assert.equal(m.isRebooting, true)

    m.close()
  })

  it('#sendHeartbeatWithParams()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 16200)
    const udpStream = udp.createSocket('udp4')

    m.eventEmitter.on('linkready', () => {
      // Send heartbeat with custom parameters
      m.sendHeartbeat(6, 8, 1) // GCS, Invalid, AUTOPILOT
    })

    udpStream.on('message', (msg) => {
      assert.ok(msg.length > 0)
      m.close()
      udpStream.close()
      done()
    })

    udpStream.send(Buffer.from([0xfd, 0x06]), 16200, '127.0.0.1')
  })

  it('#sendCommandAckWithParams()', function (done) {
    const m = new mavManager(2, '127.0.0.1', 16300)
    const udpStream = udp.createSocket('udp4')

    m.eventEmitter.on('linkready', () => {
      // Send command ack with custom parameters
      m.sendCommandAck(400, 1, 1, 1, 1)
    })

    udpStream.on('message', (msg) => {
      assert.ok(msg.length > 0)
      m.close()
      udpStream.close()
      done()
    })

    udpStream.send(Buffer.from([0xfd, 0x06]), 16300, '127.0.0.1')
  })
})