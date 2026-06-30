import { observer } from 'mobx-react-lite'
import { ConfigPanel, TabsOnTop } from '@wwf971/react-comp-misc'
import { configStore, configStruct } from './storeConfig'

function ConfigManagePanel() {
  return (
    <div className="config-panel">
      <div className="config-section-title">Configuration</div>
      <TabsOnTop defaultTab="Edit Config">
        <TabsOnTop.Tab label="Edit Config">
          {configStore.config ? (
            <ConfigPanel
              configStruct={configStruct}
              configValue={configStore.config}
              onChangeAttempt={configStore.updateConfig}
              missingItemStrategy="setDefault"
            />
          ) : (
            <div className="loading-text">{configStore.isLoading ? 'Loading configuration...' : 'Configuration not loaded.'}</div>
          )}
        </TabsOnTop.Tab>

        <TabsOnTop.Tab label="Raw JSON">
          {configStore.config ? (
            <pre className="config-json">{JSON.stringify(configStore.config, null, 2)}</pre>
          ) : (
            <div className="loading-text">{configStore.isLoading ? 'Loading configuration...' : 'Configuration not loaded.'}</div>
          )}
        </TabsOnTop.Tab>
      </TabsOnTop>
      {configStore.error && (
        <div className="app-message-bar app-message-bar-error">
          <div className="app-message-text">{configStore.error}</div>
          <button type="button" className="app-message-btn" onClick={configStore.dismissError} disabled={configStore.isLoading}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

export default observer(ConfigManagePanel)
