const assert = require('assert')
const fs = require('fs')
const sinon = require('sinon')
const si = require('systeminformation')
const settings = require('settings-store')
const FCManagerClass = require('./flightController')
const { act } = require('react')

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
    active, enableHeartbeat, enableTCP, enableUDPB, UDPBPort, enableDSRequest, enableTimesync, enableComputerStatus, tlogging,
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
      assert.equal(enableTimesync, false)
      assert.equal(enableComputerStatus, false)
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

    FC.startStopTelemetry('/dev/ttyS0', 115200, 2, false, true, false, 0, false, false, false, false,
      'UART', 9000, (err, isSuccess) => {
      assert.equal(err, null)
      assert.equal(isSuccess, true)

      FC.startStopTelemetry('/dev/ttyS0', 115200, 2 , false, true, false, 0, false, false, false, false,
        'UART', 9000, (err, isSuccess) => {
        assert.equal(err, null)
        assert.equal(isSuccess, false)
        done()
      })
    })
  })

  it('#fcSendComputerStatus()', async function () {
    const MiB = 1024 * 1024
    sinon.stub(si, 'currentLoad').resolves({ cpus: [{ load: 12.4 }, { load: 80.6 }] })
    sinon.stub(si, 'mem').resolves({ active: 512 * MiB, total: 4096 * MiB })
    sinon.stub(si, 'cpuTemperature').resolves({ main: 55, cores: [] })
    sinon.stub(fs.promises, 'statfs').resolves({ blocks: 1000, bfree: 250, bsize: MiB })
    let sent = null
    const FC = { m: { sendOnboardComputerStatus: (status) => { sent = status } } }

    await FCManagerClass.prototype.sendComputerStatus.call(FC)
    sinon.restore()

    assert.deepEqual(sent.cpuCores, [12, 81])
    assert.deepEqual(sent.cpuTemps, [55])
    assert.equal(sent.ramUsedMiB, 512)
    assert.equal(sent.ramTotalMiB, 4096)
    assert.equal(sent.diskUsedMiB, 750)
    assert.equal(sent.diskTotalMiB, 1000)
    assert.equal(FC.readingComputerStatus, false)
  })

  it('#fcSendComputerStatusMissingSensors()', async function () {
    sinon.stub(si, 'currentLoad').resolves({ cpus: [{ load: 5 }] })
    sinon.stub(si, 'mem').resolves({ active: 0, total: 0 })
    sinon.stub(si, 'cpuTemperature').resolves({ main: null, cores: [] })
    sinon.stub(fs.promises, 'statfs').rejects(new Error('no disk'))
    let sent = null
    const FC = { m: { sendOnboardComputerStatus: (status) => { sent = status } } }

    await FCManagerClass.prototype.sendComputerStatus.call(FC)
    sinon.restore()

    // still sends, with no temperature and no disk
    assert.deepEqual(sent.cpuTemps, [])
    assert.equal(sent.diskUsedMiB, undefined)
    assert.equal(sent.diskTotalMiB, undefined)
  })
})
