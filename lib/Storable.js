Ext.ns('Ext.ux.Panel');
/**
* @class Ext.ux.plugins.Storable
* A FormPanel plugin adding common [save][cancel] buttons along with associated handlers
* firing @event storable-save, storable-cancel.  Can be bound to a store with the {@link #bind}
* method.  {@link #loadRecord} method will accept an {@link Ext.data.Record} instance and recursively
* call it upon any children of type Ext.Panel implementing the #loadRecord method.  The onSave handler
* will automatically search for an instance of {@link Ext.data.FormPanel} and call the {@link Ext.data.BasicForm#updateRecord}
* upon its contained {@link Ext.data.BasicForm}.
*/
Ext.ux.Panel.Storable = function(config){
  Ext.apply(this, config);
}
Ext.ux.Panel.Storable.prototype = {

  /**
  * @cfg {String} store ID of Store instance to bind to panel.
  */
  store: undefined,
  /**
  * @cfg {String} saveButton (optional) Specifiy a dot-separted string where the left-hand-side specifies the button
  * locations [tbar|bbar|buttons] and the right-hand-side specifies the button"s itemId.
  * eg:  saveButton: "tbar.btn-save", "bbar.btn-save", "buttons.btn.save".  When the save button is located,
  * it will have an automated save-handler applied to it from Ext.ux.FormPanel.Storable.InstanceMethods#onStorableSave
  */
  saveButton: undefined,
  /**
  * @cfg {String} cancelButton (optional) Specifiy a dot-separted string where the left-hand-side specifies the button
  * locations [tbar|bbar|buttons] and the right-hand-side specifies the button"s itemId.
  * eg:  cancelButton: "tbar.btn-cancel", "bbar.btn-cancel", "buttons.btn.cancel".  When the cancel button is located,
  * it will have an automated cancel-handler applied to it from Ext.ux.FormPanel.Storable.InstanceMethods#onStorableCancel
  */
  cancelButton: undefined,

  /**
  * @cfg {String} controllerName defaults to first-word in xtype, eg: "products" for xtype of "products-editor"
  * @param {Object} panel
  */
  controllerName : undefined,

  init : function(panel) {
    if (typeof(panel.reset) === 'function') {
      panel.reset = panel.reset.createInterceptor(this.reset, panel);
    } else {
      panel.reset = this.reset.createDelegate(panel);
    }
    if (typeof(panel.bind) === 'function') {
      panel.bind = panel.bind.createInterceptor(this.bind, panel);
    } else {
      panel.bind = this.bind.createDelegate(panel);
    }
    if (typeof(panel.loadRecord) === 'function') {
      panel.loadRecord = panel.loadRecord.createInterceptor(this.loadRecord, panel);
    } else {
      panel.loadRecord = this.loadRecord.createDelegate(panel);
    }
    panel.storableOnWrite = this.storableOnWrite;
    panel.storableOnBeforeWrite = this.storableOnBeforeWrite;
    panel.storableOnException = this.storableOnException;

    // TODO: check of existing buttons?
    // this.buildUI(panel);

    if (this.saveButton) {
      this.setHandler("save", this.saveButton, panel);
    }
    if (this.cancelButton) {
      this.setHandler("cancel", this.cancelButton, panel);
    }


    // Add Storable events
    panel.addEvents('storable-beforeupdaterecord', 'storable-beforesave', 'storable-save', 'storable-cancel');
    panel.enableBubble('storable-save', 'storable-cancel');

    if (this.storeId) {
      this.store = Ext.StoreMgr.get(this.storeId);

      panel.bind(this.store);
    }
  },

  setHandler : function(action, info, panel) {
    var ids = info.split(".");
    var btn = undefined;
    if (ids[0] === "buttons") {
      for (var n = 0, len = panel.buttons.length; n < len; n++) {
        if (panel.buttons[n].itemId === ids[1]) {
          btn = panel.buttons[n];
          break;
        }
      }
    } else {
      var pos = (ids[0] === "tbar") ? "Top" : "Bottom";
      var toolbar = this["get" + pos + "Toolbar"]();
      btn = toolbar.getComponent(ids[1]);
    }
    if (!btn) {
      throw new Error("Ext.ux.FormPanel.Storable failed to find button " + ids[1] + " on " + ids[0]);
    }
    btn.setHandler(panel["onStorable"+ Ext.util.Format.capitalize(action)].createDelegate(panel));
  },

  onSave: function(btn, ev) {
    // save a ref to clicked button so we can determine whether to fire storable-save event.
    this.saveButton = btn;

    var form = (typeof(this.getForm) === 'function') ? this.getForm() : this.findByType('form')[0].getForm();
    if (!form.isValid()) {
      App.setAlert(false, App.t('form-invalid'));
      return false;
    }
    this.fireEvent('storable-beforeupdaterecord', this, this.record);
    form.updateRecord(this.record);
    if (!this.record.phantom) {
      if (!this.record.dirty) {
        this.fireEvent('storable-cancel', this);
      }
    }
    else {
      this.store.add(this.record);
    }
    if (!this.store.autoSave) {
      this.store.save();
    }
  },

  onCancel: function() {
    this.fireEvent('storable-cancel', this);
  },

  /**
  * binds a Store to the panel
  * @param {Object} store
  */
  bind : function(store) {        
    this.record = null;
    this.store = store;

    /*
    var write = this.store.events.write;
    var beforewrite = this.store.events.beforewrite;
    var exception = this.store.events.exception;
    if (Ext.isObject(write)) {
      for (var n=0,len=write.listeners.length;n<len;n++) {
        this.store.un('write', write.listeners[n].fn, write.listeners[n].scope);
        this.store.un('exception', exception.listeners[n].fn, exception.listeners[n].scope);
        this.store.un('beforewrite', beforewrite.listeners[n].fn, beforewrite.listeners[n].scope);
      }
    }
    */
    this.store.on('write', this.storableOnWrite, this);
    this.store.on('beforewrite', this.storableOnBeforeWrite, this);
    this.store.on('exception', this.storableOnException, this);
  },

  storableOnBeforeWrite : function(proxy, action) {
    if (!this.saveButton || this.hidden) {
      return true;
    }
    if (this.fireEvent('storable-beforesave', this) !== false && action != Ext.data.Api.actions.destroy) {
      this.el.mask('Saving, please wait...');
    }
  },

  storableOnWrite : function(proxy, action, data, res, rs, options) {
    if (!this.saveButton || this.hidden) {
      return true;
    }
    if (action != Ext.data.Api.actions.destroy) {
      this.el.unmask();
      this.fireEvent('storable-save', this, proxy, action, data, res, rs, options);
    }
  },

  storableOnException: function(proxy, type, action, req, res) {
    if (!this.saveButton || this.hidden) {
      return true;
    }
    this.el.unmask();
    App.setAlert(false, action + ' failure: ' + res.message);
  },

  /**
  * initiates an "edit record" action
  * @param {Object} record
  */
  loadRecord : function(record) {
    this.saveButton = null;
    this.record = record;

    var rs = this.findByType('panel');
    for (var n=0,len=rs.length;n<len;n++) {
      if (typeof(rs[n].loadRecord) === 'function') {
        rs[n].loadRecord(record);
      }
      if (typeof(rs[n].getForm) === 'function') {
        rs[n].getForm().loadRecord(record);
      }
    }
  },

  /**
  * resets the panel.
  * @param {Mixed}
  */
  reset : function(params) {
    this.saveButton = null;
    var rs = this.findByType('panel');
    for (var n=0,len=rs.length;n<len;n++) {
      if (typeof(rs[n].reset) === 'function') {
        rs[n].reset(params);
      }
      if (typeof(rs[n].getForm) === 'function') {
        rs[n].getForm().reset();
      }
    }
    this.record = new this.store.recordType({});
    this.record.beginEdit();
  }
};
Ext.preg('panel-storable', Ext.ux.Panel.Storable);
