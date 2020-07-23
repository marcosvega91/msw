import { Page } from 'puppeteer'

export const HOSTNAME = 'ws://localhost:8080/'

interface WSListeners {
  onclose: ((ev: CloseEvent) => any) | null
  onerror: ((ev: Event) => any) | null
  onmessage: ((ev: MessageEvent) => any) | null
  onopen: ((ev: Event) => any) | null
}

export const createWS = (page: Page, listeners: WSListeners) => {
  const url = new URL(HOSTNAME)

  const urlString = url.toString()

  function onopen() {
    return listeners.onopen
  }

  function onclose() {
    return listeners.onclose
  }

  function onmessage() {
    return listeners.onmessage
  }

  function onerror() {
    return listeners.onerror
  }

  page.addScriptTag({
    content: `${onclose} ${onerror} ${onmessage} ${onopen}`,
  })

  return page.evaluate((url) => {
    return new Promise((resolve, reject) => {
      const websocket = new WebSocket(url)

      if (onopen)
        websocket.onopen = (ev: Event) => {
          onopen()(ev)
          resolve('connected')
        }
      if (onerror)
        websocket.onerror = (ev: Event) => {
          onerror()(ev)
          reject('error')
        }
      if (onmessage) websocket.onmessage = onmessage
      if (onclose)
        websocket.onclose = (ev: CloseEvent) => {
          onclose()(ev)
          reject('closed')
        }

      setTimeout(resolve, 2000)
    })
  }, urlString)
}
