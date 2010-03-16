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
  
  /**
  * @cfg {Boolean} enableMask Puts a mask over the form and displays a "saving" message while the form data is being processed by the server after the user hit save. Defaults to <code>true</code>.
  */
  enableMask: true,

  init : function(panel) {
  
    // Mixin InstanceMethods
    Ext.iterate(Ext.ux.Panel.Storable.InstanceMethods, function(method, fn) {
      if (typeof(panel[method]) === 'function') {
        panel[method] = panel[method].createSequence(fn, panel);
      } else {
        panel[method] = fn;
      }
    });

    if (this.saveButton) {
      this.setHandler("save", this.saveButton, panel);
    }
    if (this.cancelButton) {
      this.setHandler("cancel", this.cancelButton, panel);
    }

    // Add Storable events
    panel.addEvents(
      'storable-beforeupdaterecord', 
      'storable-invalid', 
      'storable-beforesave', 
      'storable-save', 
      'storable-cancel'
    );
    panel.enableBubble('storable-save', 'storable-cancel');

    if (this.store) {
      this.store = Ext.StoreMgr.lookup(this.store);
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
      var toolbar = panel["get" + pos + "Toolbar"]();
      btn = toolbar.getComponent(ids[1]);
    }
    if (!btn) {
      throw new Error("Ext.ux.FormPanel.Storable failed to find button " + ids[1] + " on " + ids[0]);
    }      
    btn.setHandler(Ext.ux.Panel.Storable.InstanceMethods["on"+ Ext.util.Format.capitalize(action)].createDelegate(panel));
  }
};
Ext.preg('panel-storable', Ext.ux.Panel.Storable);


Ext.ux.Panel.Storable.InstanceMethods = {
  
  onSave: function(btn, ev) {
    // save a ref to clicked button so we can determine whether to fire storable-save event.
    this.saveButton = btn;

    var form = (typeof(this.getForm) === 'function') ? this.getForm() : this.findByType('form')[0].getForm();
    if (!form.isValid()) {
      Ext.Msg.alert('Invalid', 'Form is invalid');
      
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
    this.store.on('write', this.onStorableWrite, this);
    this.store.on('beforewrite', this.onStorableBeforeWrite, this);
    this.store.on('exception', this.onStorableException, this);
  },

  onStorableBeforeWrite : function(proxy, action) {
    if (!this.saveButton || this.hidden) {
      return true;
    }
    if (this.fireEvent('storable-beforesave', this) !== false && action != Ext.data.Api.actions.destroy) {
      if (this.enableMask) {
        this.el.mask('Saving, please wait...');
      }
    }
  },

  onStorableWrite : function(proxy, action, data, res, rs, options) {
    if (!this.saveButton || this.hidden) {
      return true;
    }
    if (action != Ext.data.Api.actions.destroy) {
      if (this.enableMask) {
        this.el.unmask();
      }
      this.fireEvent('storable-save', this, proxy, action, data, res, rs, options);
    }
  },
  
  onStorableException: function(proxy, type, action, req, res) {  
    if (!this.saveButton || this.hidden) {
      return true;
    }
    this.el.unmask();
  },

  /**
  * initiates an "edit record" action
  * @param {Object} record
  */
  loadRecord : function(record) {
    this.saveButton = null;
    this.record = record;
    
    if (typeof(this.getForm) === 'function') {
      this.getForm().loadRecord(record);
    }
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
    if (typeof(this.getForm) === 'function') {
      this.getForm().reset();
    }
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
