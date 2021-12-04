import React from 'react'

// Socket IO connection status
function SocketIOFooter(props) {
  return <div className="page-content-footer" style={{ textAlign: 'center', bottom: '5px', width: '70%' }}>{props.socketioStatus
    ? <p>
      Server Status: Connected
    </p>
    : <p>Server Status: Not Connected</p>}</div>
}

export default SocketIOFooter
