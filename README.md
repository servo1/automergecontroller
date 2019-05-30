# AutomergeController
Automerge Controller/Coordinator for multiple connections, docSets and documents - can be just peer to peer/peer to server and/or any combination thereof.

This will handle multiple connections to the same client, centralized documents and docSets.  docIds must be unique as well as docSets.  The connections also must be unique per connection.  For example, if one client is connected to 3 other clients, the connection Ids used to connect them must all be different.

##Example usage:

Server and/or client:
```var acm = require('amc')();
eventer = require('EventEmitter');

amc.on('send', sendMsg)
  .on('error', function(e) {
      console.log('AMC ERROR', e);
  });;

//here is where you should initialized your websockets server

app.ws('/*', {
        compression: 0,
        maxPayloadLength: 16 * 1024 * 1024,
        idleTimeout: 36000,
        open: this.wsOpen.bind(this),
        message: this.wsMsg.bind(this),
        drain: this.wsDrain.bind(this),
        close: this.wsClose.bind(this)
      });

function init() {
    //Example oriented for Websockets server but can easily be replaced by WebRTC
    eventer.on('wsMsgRecd', handleMsg);   //websockets received message
    eventer.on('wsopen', amc.connect.bind(amc, 'liveDocs'));  //websocket connected
    eventer.on('wsclose', amc.close.bind(amc));
  }
}
// data from request and websocket client
function handleMsg(data, ws) {
  data.connId = ws.id;   //unique id for each websocket client
  amc.handleMsg(data);
}

function sendMsg(connId, data, ws) {
  data.connId = connId;
  ws.send(data);   //
}
```
