import React from 'react'
import basePage from './basePage.jsx'
import { Card, Row, Col, Badge } from 'react-bootstrap'

class Home extends basePage {
  constructor (props) {
    super(props, true) // Enable Socket.IO
    this.state = {
      ...this.state,
      FCStatus: {
        conStatus: 'Not connected',
        numpackets: 0,
        byteRate: 0,
        vehType: '',
        FW: '',
        fcVersion: ''
      },
      NTRIPStatus: 'Not connected',
      PPPStatus: 'Not connected',
      LogConversionStatus: 'N/A',
      VideoStreamStatus: 'Not streaming'
    }

    // Socket.io listeners for status updates
    this.socket.on('FCStatus', (msg) => {
      this.setState({ FCStatus: msg })
    })

    this.socket.on('NTRIPStatus', (msg) => {
      this.setState({ NTRIPStatus: msg })
    })

    this.socket.on('PPPStatus', (msg) => {
      this.setState({ PPPStatus: msg })
    })

    this.socket.on('LogConversionStatus', (msg) => {
      this.setState({ LogConversionStatus: msg })
    })

    this.socket.on('VideoStreamStatus', (msg) => {
      this.setState({ VideoStreamStatus: msg })
    })

    this.socket.on('reconnect', () => {
      // refresh state on reconnection
      this.componentDidMount()
    })
  }

  componentDidMount () {
    this.loadDone()
  }

  // Helper method to determine status variant (color)
  getStatusVariant (status) {
    if (typeof status === 'string') {
      if (status.toLowerCase().includes('active') || status.toLowerCase().includes('connected')) {
        return 'success'
      } else if (status.toLowerCase().includes('error') || status.toLowerCase().includes('failed')) {
        return 'danger'
      } else if (status.toLowerCase().includes('not') || status.toLowerCase().includes('no')) {
        return 'secondary'
      }
    }
    return 'warning'
  }

  renderTitle () {
    return 'System Status Overview'
  }

  renderContent () {
    return (
      <div style={{ width: 650 }}>
        <div className="mb-4">
          <h5>Quick Links</h5>
          <p>Use the navigation menu to configure system components:</p>
          <ul>
            <li><a href='https://github.com/stephendade/Rpanion-server'>Rpanion-server website</a></li>
            <li><a href='https://www.docs.rpanion.com/software/rpanion-server'>Rpanion-server documentation</a></li>
          </ul>
        </div>

        <p>Welcome to the Rpanion-server home page. Real-time system status is updated every second.</p>
        
        <Row className="mb-4">
          <Col md={6} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  MAVLink Connection 
                  <Badge bg={this.getStatusVariant(this.state.FCStatus.conStatus)} className="ms-2">
                    {this.state.FCStatus.conStatus}
                  </Badge>
                </h5>
              </Card.Header>
              <Card.Body>
                <p><strong>Packets:</strong> {this.state.FCStatus.numpackets}</p>
                <p><strong>Data Rate:</strong> {this.state.FCStatus.byteRate} bytes/sec</p>
                <p><strong>Vehicle:</strong> {this.state.FCStatus.vehType}</p>
                <p><strong>Firmware:</strong> {this.state.FCStatus.FW} {this.state.FCStatus.fcVersion}</p>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  NTRIP Connection
                  <Badge bg={this.getStatusVariant(this.state.NTRIPStatus)} className="ms-2">
                    {this.state.NTRIPStatus.includes('Active') ? 'Active' : 'Inactive'}
                  </Badge>
                </h5>
              </Card.Header>
              <Card.Body>
                <p>{this.state.NTRIPStatus}</p>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  PPP Connection
                  <Badge bg={this.getStatusVariant(this.state.PPPStatus)} className="ms-2">
                    {this.state.PPPStatus.includes('Active') ? 'Active' : 'Inactive'}
                  </Badge>
                </h5>
              </Card.Header>
              <Card.Body>
                <p>{this.state.PPPStatus}</p>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  Video Streaming
                  <Badge bg={this.getStatusVariant(this.state.VideoStreamStatus)} className="ms-2">
                    {this.state.VideoStreamStatus.includes('Active') ? 'Active' : 'Inactive'}
                  </Badge>
                </h5>
              </Card.Header>
              <Card.Body>
                <p>{this.state.VideoStreamStatus}</p>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6} className="mb-3">
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  Log Conversion
                  <Badge bg={this.getStatusVariant(this.state.LogConversionStatus)} className="ms-2">
                    {this.state.LogConversionStatus === 'N/A' ? 'N/A' : (this.state.LogConversionStatus.includes('Active') ? 'Active' : 'Inactive')}
                  </Badge>
                </h5>
              </Card.Header>
              <Card.Body>
                <p>{this.state.LogConversionStatus}</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    )
  }
}

export default Home
