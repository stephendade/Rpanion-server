var assert = require('assert')
const aboutPage = require('./aboutInfo')

describe('About Functions', function () {
  describe('#getSoftwareInfo()', function () {
    it('should get software info', function (done) {
      aboutPage.getSoftwareInfo(function (OSV, NodeV, RpanionV, err) {
        assert.notEqual(OSV, '')
        assert.notEqual(NodeV, '')
        assert.notEqual(RpanionV, '')
        assert.equal(err, null)
        done()
      })
    })
  })

  describe('#getDiskInfo()', function () {
    it('should get disk info', function (done) {
      aboutPage.getDiskInfo(function (total, used, percent, err) {
        assert.notEqual(total, 0)
        assert.notEqual(used, 0)
        assert.notEqual(percent, 0)
        assert.equal(err, null)
        done()
      })
    })
  })

  describe('#getHardwareInfo()', function () {
    it('should get hardware info', function (done) {
      aboutPage.getHardwareInfo(function (RAM, CPU, HAT, err) {
        assert.notEqual(RAM, '')
        assert.notEqual(CPU, '')
        assert.equal(HAT.product, '')
        assert.equal(HAT.vendor, '')
        assert.equal(HAT.version, '')
        assert.equal(err, null)
        done()
      })
    })
  })
})
