const assert = require('assert')
const settings = require('settings-store')
const FCManagerClass = require('./flightController')
const winston = require('./winstonconfig')(module)

describe('Flight Controller Functions', function () {
  it('#fcinit()', function () {
    settings.clear()
    const FC = new FCManagerClass(settings, winston)

    // check initial status
    assert.equal(FC.getSystemStatus().conStatus, 'Not connected')
    assert.equal(FC.previousConnection, false)
  })

  it('#fcGetSerialDevices()', async () => {
    settings.clear()
    const FC = new FCManagerClass(settings, winston)

    await FC.getSerialDevices((err, devices, bauds, seldevice, selbaud, mavers, selmav, active, enableHeartbeat, enableTCP, enableUDPB, UDPBPort, enableDSRequest) => {
      assert.equal(err, null)
      assert.equal(devices.length, 0)
      assert.equal(bauds.length, 12)
      assert.equal(seldevice.length, 0)
      assert.equal(selbaud.value, 57600)
      assert.equal(mavers.length, 2)
      assert.equal(selmav.value, 2)
      assert.equal(active, false)
      assert.equal(enableHeartbeat, false)
      assert.equal(enableTCP, false)
      assert.equal(enableUDPB, true)
      assert.equal(UDPBPort, 14550)
      assert.equal(enableDSRequest, false)
    })
  })

  it('#fcUDPadderemove()', function () {
    settings.clear()
    const FC = new FCManagerClass(settings, winston)

    // check initial status
    assert.equal(FC.getUDPOutputs().length, 0)

    // add udp
    FC.addUDPOutput('127.0.0.1', 15000)
    assert.equal(FC.getUDPOutputs().length, 1)

    // duplicate add
    FC.addUDPOutput('127.0.0.1', 15000)
    assert.equal(FC.getUDPOutputs().length, 1)

    // another add
    FC.addUDPOutput('127.0.0.1', 15001)
    assert.equal(FC.getUDPOutputs().length, 2)

    // remove
    FC.removeUDPOutput('127.0.0.1', 15001)
    assert.equal(FC.getUDPOutputs().length, 1)

    // remove non-valid
    FC.removeUDPOutput('127.0.0.1', 15003)
    assert.equal(FC.getUDPOutputs().length, 1)
  })

  it('#fcStartStop()', function (done) {
    settings.clear()
    const FC = new FCManagerClass(settings, winston)
    FC.serialDevices.push({ value: '/dev/ttyS0', label: '/dev/ttyS0', pnpId: '456' })

    FC.startStopTelemetry({ pnpId: '456' }, { value: 115200 }, { value: 2 }, false, true, false, 0, false, (err, isSuccess) => {
      assert.equal(err, null)
      assert.equal(isSuccess, true)

      FC.startStopTelemetry({ pnpId: '456' }, { value: 115200 }, { value: 2 }, false, true, false, 0, false, (err, isSuccess) => {
        assert.equal(err, null)
        assert.equal(isSuccess, false)
        done()
      })
    })
  })
})
