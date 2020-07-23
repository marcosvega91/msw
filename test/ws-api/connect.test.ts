import * as path from 'path'
import { TestAPI, runBrowserWith } from '../support/runBrowserWith'
import { createWS } from './utils/ws'
import { captureConsole } from '../support/captureConsole'

describe('WS: Connect', () => {
  let runtime: TestAPI

  beforeAll(async () => {
    runtime = await runBrowserWith(path.resolve(__dirname, 'connect.mocks.ts'))
  })

  afterAll(() => {
    return runtime.cleanup()
  })

  it('should connect to websocket', async () => {
    const logs = []
    captureConsole(runtime.page, logs)

    await createWS(runtime.page, {
      onopen: () => {
        console.log('open')
      },
      onerror: () => {
        console.log('error')
      },
      onclose: () => {
        console.log('close')
      },
      onmessage: () => {
        console.log('message')
      },
    })

    console.log(logs)
  })
})
