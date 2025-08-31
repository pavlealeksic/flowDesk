import { FlowDeskAPI } from '../preload/preload'

declare global {
  interface Window {
    flowDesk: FlowDeskAPI
  }
}
