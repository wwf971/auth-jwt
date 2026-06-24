import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { Login, TabsOnTop, KeyValues, ConfigPanel } from '@wwf971/react-comp-misc'
import ServerStatus from './ServerStatus'
import DbPanel from './DbPanel'
import { manageStore } from './store'
import './App.css'

function App() {
  const tabsOnTopRef = useRef(null)

  const configStruct = {
    items: [
      {
        id: 'service_ports',
        label: 'Service Ports',
        type: 'group',
        children: [
          {
            id: 'PORT_SERVICE_GRPC',
            label: 'gRPC Service Port',
            description: 'Port for gRPC authentication service',
            type: 'number',
            defaultValue: 16200
          },
          {
            id: 'PORT_SERVICE_HTTP',
            label: 'HTTP Service Port',
            description: 'Port for HTTP authentication service',
            type: 'number',
            defaultValue: 16201
          },
          {
            id: 'PORT_MANAGE',
            label: 'Management Port',
            description: 'Port for management UI',
            type: 'number',
            defaultValue: 16202
          },
          {
            id: 'PORT_AUX',
            label: 'Auxiliary Port',
            description: 'Port for auxiliary internal API',
            type: 'number',
            defaultValue: 16203
          }
        ]
      },
      {
        id: 'jwt_config',
        label: 'JWT Configuration',
        type: 'group',
        children: [
          {
            id: 'JWT_ALGORITHM',
            label: 'JWT Algorithm',
            description: 'Algorithm for JWT signing (RS256 for RSA, HS256 for HMAC)',
            type: 'select',
            options: ['RS256', 'HS256', 'ES256'],
            defaultValue: 'RS256'
          },
          {
            id: 'JWT_EXPIRATION_HOURS',
            label: 'JWT Expiration (hours)',
            description: 'Token expiration time in hours',
            type: 'number',
            defaultValue: 24
          }
        ]
      },
      {
        id: 'security',
        label: 'Security',
        type: 'group',
        children: [
          {
            id: 'BCRYPT_ROUNDS',
            label: 'Bcrypt Rounds',
            description: 'Number of rounds for password hashing (higher = more secure but slower)',
            type: 'number',
            defaultValue: 12
          }
        ]
      },
      {
        id: 'db_pool',
        label: 'Db Connection Pool',
        type: 'group',
        children: [
          {
            id: 'DATABASE_POOL_SIZE',
            label: 'Pool Size',
            description: 'Number of connections to maintain',
            type: 'number',
            defaultValue: 10
          },
          {
            id: 'DATABASE_MAX_OVERFLOW',
            label: 'Max Overflow',
            description: 'Maximum overflow connections',
            type: 'number',
            defaultValue: 20
          },
          {
            id: 'DATABASE_POOL_TIMEOUT',
            label: 'Pool Timeout (seconds)',
            description: 'Connection timeout in seconds',
            type: 'number',
            defaultValue: 30
          },
          {
            id: 'DATABASE_POOL_RECYCLE',
            label: 'Pool Recycle (seconds)',
            description: 'Recycle connections after this many seconds',
            type: 'number',
            defaultValue: 3600
          }
        ]
      }
    ]
  }

  useEffect(() => {
    if (manageStore.isLoggedIn) {
      manageStore.bootstrap()
    }
  }, [manageStore.isLoggedIn])

  const handleTokenView = async (jti) => {
    await manageStore.viewToken(jti)
    if (tabsOnTopRef.current) {
      tabsOnTopRef.current.switchTab('jwt tokens')
    }
  }

  if (!manageStore.isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-spacer" />
        <Login 
          data={manageStore}
          title="Management Login"
          onDataChangeRequest={manageStore.onDataChangeRequest}
          useAuthToken={true}
          showTokenAtLogin={true}
        />
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="page-title">User Management Dashboard</div>
          <button onClick={manageStore.logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="dashboard-content">
        <ServerStatus />
        <DbPanel />
        
        <div className="tabs-wrapper">
          <TabsOnTop ref={tabsOnTopRef} defaultTab="users">
            <TabsOnTop.Tab label="Users">
              {manageStore.error && <div className="error-message">{manageStore.error}</div>}

              <div className="table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>UID</th>
                      <th>Username</th>
                      <th>Password Hash</th>
                      <th>JWT Tokens</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manageStore.users.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="no-data">No users found</td>
                      </tr>
                    ) : (
                      manageStore.users.map((user) => (
                        <tr key={user.uid}>
                          <td>{user.uid}</td>
                          <td>{user.username}</td>
                          <td className="password-hash">{user.password_hash}</td>
                          <td className="token-ids">
                            {user.jwt_token_ids.length > 0 ? (
                              <div className="token-list">
                                {user.jwt_token_ids.map((jti, idx) => (
                                  <button
                                    key={idx}
                                    className="token-info-btn"
                                    title={jti}
                                    onClick={() => handleTokenView(jti)}
                                  >
                                    {jti.substring(0, 8)}...
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <button 
                                className="action-btn issue-btn"
                                onClick={() => manageStore.issueToken(user.uid)}
                                disabled={manageStore.isLoading}
                              >
                                Issue
                              </button>
                            )}
                          </td>
                          <td>
                            <button 
                              onClick={() => manageStore.deleteUser(user.uid)}
                              className="action-btn delete-btn"
                              disabled={manageStore.isLoading}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="user-create-row">
                <input
                  className="text-input"
                  value={manageStore.userDraft.username}
                  onChange={(event) => manageStore.setUserDraftField('username', event.target.value)}
                  placeholder="username"
                />
                <input
                  className="text-input"
                  value={manageStore.userDraft.password}
                  onChange={(event) => manageStore.setUserDraftField('password', event.target.value)}
                  placeholder="password"
                  type="password"
                />
                <button onClick={manageStore.createUser} className="create-btn" disabled={manageStore.isLoading}>
                  Create User
                </button>
                <button onClick={manageStore.fetchUsers} className="refresh-btn" disabled={manageStore.isLoading}>
                  {manageStore.isLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
          </TabsOnTop.Tab>

          <TabsOnTop.Tab label="JWT Tokens">
            <div className="section-header">
              <div className="section-title">JWT Token Details</div>
            </div>
            {manageStore.selectedToken ? (
              <div className="token-details">
                <KeyValues
                  data={Object.entries(manageStore.selectedToken).map(([key, value]) => ({
                    key,
                    value: typeof value === 'object' ? JSON.stringify(value) : String(value)
                  }))}
                  isEditable={false}
                  alignColumn={true}
                  keyColWidth="min"
                />
              </div>
            ) : (
              <div className="no-token-selected">
                Select a token from the Users table to view its details
              </div>
            )}
          </TabsOnTop.Tab>

        </TabsOnTop>
        </div>

        <div className="config-panel">
          <div className="config-section-title">Configuration</div>
          <TabsOnTop defaultTab="Edit Config">
            <TabsOnTop.Tab label="Edit Config">
              {manageStore.config ? (
                <ConfigPanel
                  configStruct={configStruct}
                  configValue={manageStore.config}
                  onChangeAttempt={manageStore.updateConfig}
                  missingItemStrategy="setDefault"
                />
              ) : (
                <div className="loading-text">Loading configuration...</div>
              )}
            </TabsOnTop.Tab>

            <TabsOnTop.Tab label="Raw JSON">
              {manageStore.config ? (
                <pre className="config-json">{JSON.stringify(manageStore.config, null, 2)}</pre>
              ) : (
                <div className="loading-text">Loading configuration...</div>
              )}
            </TabsOnTop.Tab>
          </TabsOnTop>
        </div>
      </main>
    </div>
  )
}

export default observer(App)
