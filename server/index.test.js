const assert = require('assert')
// Import dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const app = require('./index')

// Configure chai
chai.use(chaiHttp)
chai.should()

describe('Express server', function () {
  // Test the GET / endpoint
  describe('GET /', function () {
    it('should return a 200 status code', function (done) {
      chai.request(app)
        .get('/')
        .set('Accept', 'application/json')
        .end(function (err, res) {
          assert.equal(res.status, 200)
          assert.equal(err, null)
          done()
        })
    })
  })
})
