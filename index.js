//var mroute = require('mroute');
var Automerge = require('automerge'),
  mc = require('mc');

/**
 * AutomergeController
 *
 * Encapsulates all required functionality to have shared document conns
 *  from document/set creation to the creation of conns
 *
 * only dependency is Automerge and event emitter which is passed in as it's first
 *  argument.
 *
 *  Can be used indepedent of having a connection simply to manage local documents
 *   from a single object.
 *
 * coordinates conns amongst multiple conns
 *  operates independent of connection types via use of event emitters
 *  event paths can be configured through config options
 *
 */

(function() {
  // Constructor. Takes the current document as a string and optionally the array
  // of all operations.
  var verbose = 0;

  /**
   * AutomergeController - description
   *
   * @param  {string} prefix prefix for event emitter
   * @return {object}        instance of
   */
  function AutomergeController(prefix) {
    if (!(this instanceof AutomergeController)) return new AutomergeController(prefix);
    this.docs = {}; // key is docid and val is automerge doc
    this.docSets = {}; // {key/property is docSet name, value is the actual doc set}
    this.setsToDocs = {};
    this.conns = {}; //  key ideally is a unique id for connection and val is automerge.connection
    this.connsToSets = {};
    this.isNotTesting = true;
    this.prefix = prefix || '';
    this.defDocSetID = null;
    mc.call(this);  //replace mc with your own event emitter
    return this;
  }
  //replace mc and inherits function with your event emitter and inherits utility
  inherits(mc, AutomergeController)
  /*
    MSG SECTION
  */

  /**
   * AutomergeController.prototype.setDefaultDocSetId - most function names are self descriptive
   *
   * @param  {type} docSetId description
   * @return {type}          description
   */
  AutomergeController.prototype.setDefaultDocSetId = function(docSetId) {
    if (typeof docSetId === 'string') this.defDocSetId = docSetId;
    else this.emit('error', 'setDefaultDoctSetId requires a string as a parameter');
  };

  // Call this method whenever you receive an operation from a client.
  AutomergeController.prototype.handleMsg = function(msg) {
    if (!msg.type) msg.type = 'text';
    if (this.defDocSetID && !msg.docSetId) msg.docSetId = this.defDocSetID;
    this.docSet(msg.docSetId);
    this.msgDoc(msg.docSetId, msg.docId)
    this.receiveMsg(msg);
    return this;
  };

  AutomergeController.prototype.docSet = function(docSetId) {
    if (this.docSets[docSetId] === undefined) {
      this.docSets[docSetId] = new Automerge.DocSet();
      this.docSets[docSetId].registerHandler(this.handleSetChange.bind(this, docSetId));
    }
  }

  AutomergeController.prototype.msgDoc = function(docSetId, docId) {
    if (this.defDocSetID && !docSetId) docSetId = this.defDocSetID;
    if (typeof docSetId === 'string' && (typeof docId === 'string' || !isNaN(docId))) {
      this.docs[docId] = this.docSets[docSetId].getDoc(docId);
    } else this.emit('error', 'docSetID (string) and docId (unique Id) are both required')
  }

  AutomergeController.prototype.receiveMsg = function(msg) {
    if (this.defDocSetID && !msg.docSetId) msg.docSetId = this.defDocSetID;
    if (this.conns[msg.connId] && this.conns[msg.connId].conn) {
      this.conns[msg.connId].conn.receiveMsg(msg);
    } else ge('CONN DOES NOT EXIST!?', msg.connId, msg.docSetId);
  }

  AutomergeController.prototype.connect = function(docSetId, connId) {
    //Connection requires DocSet
    if (this.defDocSetId && (!docSetId)) docSetId = this.defDocSetId;
    if (typeof connId === 'string' && typeof docSetId === 'string') {
      this.docSet(docSetId);
      if (this.conns[connId] === undefined) {
        this.conns[connId] = {
          lastActive: [],
          conn: new Automerge.Connection(this.docSets[docSetId], this.send.bind(this, connId, docSetId))
        };
        this.conns[connId].conn.open();
        this.connToSet(connId, docSetId);
      }
    } else this.emit('error', 'conn function required connId, docSetId (both strings) and send function');
    return this;
  }

  AutomergeController.prototype.handleSetChange = function(docSetId, docId, doc) {
    var docPath = this.prefix + docSetId + '/' + docId + '/changes';
    if (docId && this.docs[docId] && this.listeners(docPath, true)) {
      var nchanges = Automerge.diff(this.docs[docId], doc),
        achanges = Automerge.getChanges(this.docs[docId], doc);
      this.docs[docId] = doc;
      if (nchanges.length > 0) this.emit(docPath, nchanges)
    } //else this.emit('error', 'handleSetChange passed no argument or no/nonexistent doc');
  }

  AutomergeController.prototype.send = function(connId, docSetId, data) {
    data.connId = connId;
    data.route = this.prefix + docSetId
    this.emit('send', data);
  }

  AutomergeController.prototype.close = function(connId) {
    if (typeof connId === 'string' && this.conns[connId] && this.conns[connId].conn) {
      this.conns[connId].conn.close();
      delete this.conns[connId]
    }
    else this.emit('error', 'close connection called on non existent connection:' + connId);
  }

  //   --------------- DOCS --------------------------

  AutomergeController.prototype.getDoc = function(docId) {
    return this.docs[docId];
  }

  AutomergeController.prototype.createDoc = function(docId, docSetId, type = 'text', initContent) {
    if (this.defDocSetID && !docSetId) docSetId = this.defDocSetID;
    if (this.docs[docId] === undefined) {
      this.docs[docId] = Automerge.change(Automerge.init(), 'new doc', this.initText.bind(this, initContent));
      ge(this.docs[docId])
      this.setToDoc(docSetId, docId);
    }
    return this.docs[docId];
  }

  AutomergeController.prototype.initText = function(initContent, doc) {
    doc.text = new Automerge.Text();
    if (typeof initContent === 'string') this.textIns(0, initContent, doc);
  }

  AutomergeController.prototype.loadDoc = function(docId, amdata, docSetId) {
    if (this.defDocSetId && !docSetId) docSetId = this.defDocSetId;
    if (typeof docSetId === 'string' && (typeof docId === 'string' || !isNaN(docId)) && amdata) {
      this.docSet(docSetId);
      if (typeof amdata !== 'string') amdata = JSON.stringify(amdata);
      this.docs[docId] = Automerge.load(amdata);
      this.setToDoc(docSetId, docId);
      this.emit('docLoaded', docId, this.docs[docId].text.join(''))
    } else emit('error', 'loadDoc requires docId, amdata and docsetid');
    return this;
  }


  //-------------------Basic Text Operations -------------------------

  AutomergeController.prototype.handleChanges = function(docId, changes) {
    if ((typeof docId === 'string' || !isNaN(docId)) && this.docs[docId]) {
      this.docs[docId] = Automerge.change(this.docs[docId], this.doChanges.bind(this, changes));
      this.setToDoc(null, docId);
    } else this.emit('error', 'handleChanges requires docId and changes');
  }
  AutomergeController.prototype.doChanges = function(changes, doc) {
    var i = 0,
      len = changes.length,
      cchange;
    for (; i < len; i++) {
      cchange = changes[i];
      if (cchange[0] === '-') this.textRem(cchange[1], cchange[2], doc);
      else this.textIns(cchange[1], cchange[2], doc);
    }
  }
  AutomergeController.prototype.setText = function(docId, text, at) {
    this.docs[docId] = Automerge.change(this.docs[docId], this.textIns.bind(this, text, at));
    this.setToDoc(null, docId);
  }
  AutomergeController.prototype.textIns = function(text, at, doc) {
    if (!at) at = 0;
    doc.text.insertAt(at, ...text.split(''));
  }
  AutomergeController.prototype.remText = function(docId, at, length) {
    this.docs[docId] = Automerge.change(this.docs[docId], this.textRem.bind(this, at, length));
    this.setToDoc(null, docId);
  }
  AutomergeController.prototype.textRem = function(at, length, doc) {
    doc.text.splice(at, length)
  }


  //--------------------DOCSET --------------------------


  AutomergeController.prototype.connToSet = function(connId, docSetId) {
    if (this.defDocSetID && !docSetId) docSetId = this.defDocSetID;
    if (this.connsToSets[connId] === undefined) this.connsToSets[connId] = [];
    if (this.connsToSets[connId].indexOf(docSetId) === -1) this.connsToSets[connId].push(docSetId);
  }

  //generally 2 use cases - when creating a new doc or when changing a doc and having to reset link to docset
  AutomergeController.prototype.setToDoc = function(docSetId, docId) {
    if (this.defDocSetID && !docSetId) docSetId = this.defDocSetID;
    if (docSetId) {
      if (this.setsToDocs[docSetId] === undefined) this.setsToDocs[docSetId] = [];
      if (this.setsToDocs[docSetId].indexOf(docId) === -1) this.setsToDocs[docSetId].push(docId);
      this.docSets[docSetId].setDoc(docId, this.docs[docId]);
    } else {
      var docSet;
      for (docSet in this.setsToDocs) {
        if (this.setsToDocs[docSet].indexOf(docId) !== -1) {
          this.docSets[docSet].setDoc(docId, this.docs[docId]);
        }
      }
    }
  }

  AutomergeController.prototype.exportSave = function(docId) {
    if (this.docs[docId] === undefined) this.emit('error', docId + ' doc does not exist');
    else return {
      docId: docId,
      content: Automerge.save(this.docs[docId])
    };
  }

  if (typeof module !== "undefined" && ('exports' in module)) {
    module.exports = AutomergeController;
  } else window.AutomergeController = AutomergeController;

})();
