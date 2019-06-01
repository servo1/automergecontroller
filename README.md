# AutomergeController
Automerge Controller/Coordinator for multiple connections, docSets and documents - can be just peer to peer/peer to server and/or any combination thereof.

This will handle multiple connections to the same client, centralized documents and docSets.  docIds must be unique as well as docSets.  The connections also must be unique per connection.  For example, if one client is connected to 3 other clients, the connection Ids used to connect them must all be different.

You will need to replace 'mc' as it's used as an eventemitter with your own.  This is a WIP.
##Example usage:

One the client:
```
var textbox = document.getElementById('mytextboxid),
  cm = CodeMirror.fromTextArea(textbox),
  liveCodeArea = new LiveDoc(cm),
  amc = require('automergeController')('/automerge/');

amc.setDefaultDocSetId('liveDocs');
ws.on('connId', handleConnId);
ws.on('close', amc.close.bind(amc))
ws.on('/automerge/:docSetId', receiveMsg);
amc.on('send', sendMsg);
amc.on('docLoaded', liveCodeArea.init.bind(liveCodeArea));
liveCodeArea.on('changes', amc.handleChanges.bind(amc));
amc.on('/automerge/livedocs/:docid/changes', function(changes){
  liveCodeArea.applyToCM(changes)
});

function sendMsg(data) {  //route to server
  data.docSetId = amc.defDocSetId;
  ws.send(data.route, data);
}

function receiveMsg(data, params) {  /receive from server
  amc.handleMsg(data);
}

function handleConnId() {
  amc.connect(null, ws.connId);  //map to your connection id
}
```
On the server:

```
//After websockets server setup:
var amc = require('./autoMergeController')('/automerge')  //initialize instance and set prefix

amc.setDefaultDocSetId('liveDocs');
amc.on('send', sendMsg);
amc.on('error', function(e) {
  console.log('AMC ERROR', e);
});;

function onOpen(ws, req){
  amc.connect('liveDocs', ws.id)  //or your docSetId and connection id
}

function onMessage(ws, msg){
  data.connId = ws.id;   //unique id for each websocket client
  amc.handleMsg(data);
}

function onClose(ws){
  amc.close(ws.id)  //or however you pass your connection id
}

function sendMsg(connId, data, ws) {
  data.connId = connId;
  ws.send(data);   //
}
```
