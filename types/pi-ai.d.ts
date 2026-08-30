declare module "@earendil-works/pi-ai" {
  export type Api = any;
  export type Model<T = any> = any;
  export type Context = any;
  export type SimpleStreamOptions = any;
  export type AssistantMessage = any;
  export type AssistantMessageEvent = any;
  export type AssistantMessageEventStream = any;
}

declare module "@earendil-works/pi-ai/compat" {
  export const streamSimple: any;
  export const createAssistantMessageEventStream: any;
  export const registerApiProvider: any;
}

declare module "@earendil-works/pi-ai/providers/all" {
  export const getBuiltinModels: any;
}
