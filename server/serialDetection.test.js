const assert = require('assert')
const hardwareDetection = require('./serialDetection.js')

describe('Hardware Detection Functions', function () {
  describe('#detectSerialDevices()', function () {
    it('should return an array of serial devices', async function () {
      const devices = await hardwareDetection.detectSerialDevices()
      assert(Array.isArray(devices), 'Should return an array')
      
      // Each device should have required properties
      devices.forEach(device => {
        assert(device.hasOwnProperty('value'), 'Device should have value property')
        assert(device.hasOwnProperty('label'), 'Device should have label property')
      })
    })
  })

  describe('#isPi()', function () {
    it('should return a boolean', function () {
      const result = hardwareDetection.isPi()
      assert(typeof result === 'boolean', 'Should return boolean')
    })
  })

  describe('#isOrangePi()', function () {
    it('should return a boolean', function () {
      const result = hardwareDetection.isOrangePi()
      assert(typeof result === 'boolean', 'Should return boolean')
    })
  })

  describe('#isModemManagerInstalled()', function () {
    it('should return a boolean', function () {
      const result = hardwareDetection.isModemManagerInstalled()
      assert(typeof result === 'boolean', 'Should return boolean')
    })
  })
})
