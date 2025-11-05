const assert = require('assert')
const settings = require('settings-store')
const FCManagerClass = require('./flightController')

describe('Flight Controller Functions', function () {
  it('#fcinit()', function () {
    settings.clear()
    const FC = new FCManagerClass(settings)

    // check initial status
    assert.equal(FC.getSystemStatus().conStatus, 'Not connected')
    assert.equal(FC.previousConnection, false)
  })

  it('#fcGetSerialDevices()', async function () {
    settings.clear()
    const FC = new FCManagerClass(settings)

    await FC.getDeviceSettings((err, devices, bauds, seldevice, selbaud, mavers, selmav,
    active, enableHeartbeat, enableTCP, enableUDPB, UDPBPort, enableDSRequest, tlogging,
    udpInputPort, selInputType, inputTypes) => {
      assert.equal(err, null)
      assert.equal(devices.length, 0)
      assert.equal(bauds.length, 12)
      assert.equal(seldevice.length, 0)
      assert.equal(selbaud, 57600)
      assert.equal(mavers.length, 2)
      assert.equal(selmav, 2)
      assert.equal(active, false)
      assert.equal(enableHeartbeat, false)
      assert.equal(enableTCP, false)
      assert.equal(enableUDPB, true)
      assert.equal(UDPBPort, 14550)
      assert.equal(enableDSRequest, false)
      assert.equal(active, false)
      assert.equal(udpInputPort, 9000)
      assert.equal(selInputType, 'UART')
      assert.equal(inputTypes.length, 2)
    })
  })

  it('#fcUDPadderemove()', function () {
    settings.clear()
    const FC = new FCManagerClass(settings)

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
    const FC = new FCManagerClass(settings)
    FC.serialDevices.push({ value: '/dev/ttyS0', label: '/dev/ttyS0', pnpId: '456' })

    FC.startStopTelemetry({ pnpId: '456' }, 115200, 2, false, true, false, 0, false, false,
      'UART', 9000, (err, isSuccess) => {
      assert.equal(err, null)
      assert.equal(isSuccess, true)

      FC.startStopTelemetry({ pnpId: '456' }, 115200, 2 , false, true, false, 0, false, false,
        'UART', 9000, (err, isSuccess) => {
        assert.equal(err, null)
        assert.equal(isSuccess, false)
        done()
      })
    })
  })
})
