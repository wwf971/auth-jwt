import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { Login, TabsOnTop, ConfigPanel, FolderView } from '@wwf971/react-comp-misc'
import ServerStatus from './ServerStatus'
import DbPanel from './DbPanel'
import UserCreate from './UserCreate'
import UserPermissionEdit from './UserPermissionEdit'
import ServicePermissionCreate from './ServicePermissionCreate'
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

  const handleSelectedTokenView = async () => {
    const jti = manageStore.userSelected?.jwt_token_ids?.[0]
    if (jti) {
      await handleTokenView(jti)
    }
  }

  const handleUserFolderEvent = (eventType, eventData) => {
    const result = manageStore.handleUserFolderEvent(eventType, eventData)
    if (
      eventType === 'rowContextMenuItemClick'
      && eventData.item?.id === 'view_tokens'
      && tabsOnTopRef.current
    ) {
      tabsOnTopRef.current.switchTab('jwt tokens')
      handleSelectedTokenView()
    }
    return result
  }

  if (!manageStore.isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-spacer" />
        <Login 
          data={manageStore}
          title="Auth(Jwt) Management Console"
          onDataChangeRequest={manageStore.onDataChangeRequest}
          useAuthToken={true}
          showTokenAtLogin={true}
        />
      </div>
    )
  }

  return (
    <div className="dashboard">
      <UserCreate />
      <UserPermissionEdit />
      <ServicePermissionCreate />
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
              <div className="user-panel">
                <div className="user-panel-title-row">
                  <div className="section-title">Users</div>
                  <div className="user-selected-text">
                    {manageStore.userSelected ? `Selected: ${manageStore.userSelected.username}` : 'No user selected'}
                  </div>
                </div>
                <div className="user-control-row">
                  <button type="button" className="action-btn" onClick={() => manageStore.openPopup('user-create')} disabled={manageStore.isLoading}>
                    Create User
                  </button>
                  <button type="button" className="action-btn" onClick={() => manageStore.openPopup('permission-edit')} disabled={manageStore.isUserActionDisabled}>
                    Edit Permissions
                  </button>
                  <button type="button" className="action-btn" onClick={() => manageStore.openPopup('service-permission-create')} disabled={manageStore.isLoading}>
                    Declare Service Permission
                  </button>
                  <button type="button" className="action-btn" onClick={() => manageStore.issueToken(manageStore.userSelected.uid)} disabled={manageStore.isUserActionDisabled}>
                    Issue Token
                  </button>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={handleSelectedTokenView}
                    disabled={manageStore.isUserActionDisabled || !manageStore.userSelected?.jwt_token_ids?.length}
                  >
                    View Token
                  </button>
                  <button type="button" className="action-btn delete-btn" onClick={() => manageStore.deleteUser(manageStore.userSelected.uid)} disabled={manageStore.isUserActionDisabled}>
                    Delete User
                  </button>
                  <button type="button" className="action-btn" onClick={manageStore.fetchUsers} disabled={manageStore.isLoading}>
                    {manageStore.isLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                <FolderView
                  data={manageStore.userFolderData}
                  config={manageStore.userFolderConfig}
                  onEvent={handleUserFolderEvent}
                />
              </div>
          </TabsOnTop.Tab>

          <TabsOnTop.Tab label="JWT Tokens">
            <div className="user-panel">
              <div className="user-panel-title-row">
                <div className="section-title">JWT Tokens</div>
                <div className="user-selected-text">
                  {manageStore.tokenSelectedJti ? `Selected: ${manageStore.tokenSelectedJti}` : 'No token selected'}
                </div>
              </div>
              <div className="user-control-row">
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => manageStore.issueToken(manageStore.uidForTokenIssue)}
                  disabled={manageStore.isLoading || !manageStore.uidForTokenIssue}
                >
                  Add Token
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => manageStore.viewToken(manageStore.tokenSelectedJti)}
                  disabled={manageStore.isTokenActionDisabled}
                >
                  View Token
                </button>
                <button
                  type="button"
                  className="action-btn delete-btn"
                  onClick={() => manageStore.deleteToken(manageStore.tokenSelectedJti)}
                  disabled={manageStore.isTokenActionDisabled}
                >
                  Delete Token
                </button>
                <button type="button" className="action-btn" onClick={manageStore.fetchUsers} disabled={manageStore.isLoading}>
                  {manageStore.isLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <FolderView
                data={manageStore.tokenFolderData}
                config={manageStore.tokenFolderConfig}
                onEvent={manageStore.handleTokenFolderEvent}
              />
            </div>
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
