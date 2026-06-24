import { observer } from 'mobx-react-lite'
import { manageStore } from './store'
import './ServerStatus.css'

const ServerStatusPanel = observer(function ServerStatusPanel({ serverKey }) {
  const server = manageStore.serverStatusByKey[serverKey]

  const getStatusColor = () => {
    if (server.isAlive === null) return 'status-unknown'
    return server.isAlive ? 'status-alive' : 'status-down'
  }

  const getStatusText = () => {
    if (server.isAlive === null) return 'Unknown'
    return server.isAlive ? 'Alive' : 'Down'
  }

  return (
    <div className="server-panel">
      <div className="server-name">{server.name.toUpperCase()} Server</div>
      <div className="server-info">
        <div className="server-row">
          <span className="server-row-label">Port:</span>
          <span className="server-row-value">{server.port}</span>
        </div>
        <div className="server-row">
          <span className="server-row-label">Status:</span>
          <span className={`server-row-value ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          <button onClick={() => manageStore.checkServer(serverKey)} className="renew-btn">
            Renew
          </button>
        </div>
      </div>
    </div>
  )
})

function ServerStatus() {
  return (
    <div className="server-status-container">
      <div className="section-title">Server Status</div>
      <div className="server-panels">
        <ServerStatusPanel serverKey="aux" />
        <ServerStatusPanel serverKey="grpc" />
        <ServerStatusPanel serverKey="http" />
      </div>
    </div>
  )
}

export default observer(ServerStatus)

