export interface AriConfig {
    url: string;
    username: string;
    password: string;
    appName: string;
  }
  
  export interface AriChannel {
    id: string;
    name: string;
    state: string;
    caller: {
      name: string;
      number: string;
    };
    connected: {
      name: string;
      number: string;
    };
    // Añadir más propiedades según necesidades
  }
  
  export interface AriCallEvent {
    type: string;
    channel?: AriChannel;
    timestamp: string;
    asterisk_id: string;
    // Añadir más propiedades según necesidades
  }